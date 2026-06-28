<?php

namespace App\Services;

use Google\Client;
use Google\Service\Docs;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;
use Google\Service\Drive\Permission;

class GoogleDocsService {
    private Client $client;
    private Docs   $docsService;
    private Drive  $driveService;

    public function __construct() {
        $this->client = new Client();
        $this->client->setAuthConfig(base_path(config('services.google_docs.credentials')));
        $this->client->setScopes([
            Docs::DOCUMENTS,
            Drive::DRIVE,
        ]);

        $this->docsService  = new Docs($this->client);
        $this->driveService = new Drive($this->client);
    }

    /**
     * Generate certificate PDF dari Google Docs template, upload ke Shared Drive.
     * Returns ['file_id', 'view_url', 'download_url'].
     */
    public function generateAndUploadCertificate(array $data, string $templateDocId, string $driveFolderId): array {
        $copiedFileId = $this->copyTemplate($templateDocId, $data['filename'] ?? 'Certificate');

        try {
            $this->replacePlaceholders($copiedFileId, $data);
            $pdfContent = $this->exportAsPdf($copiedFileId);
        } finally {
            $this->deleteDoc($copiedFileId);
        }

        $uploadedFile = $this->uploadPdfToDrive($pdfContent, $data['filename'] ?? 'Certificate', $driveFolderId);
        $this->setPublicPermission($uploadedFile->getId());

        $fileId = $uploadedFile->getId();

        return [
            'file_id'      => $fileId,
            'view_url'     => "https://drive.google.com/file/d/{$fileId}/view",
            'download_url' => "https://drive.google.com/uc?export=download&id={$fileId}",
        ];
    }

    private function copyTemplate(string $templateDocId, string $title): string {
        $copiedFile = new DriveFile(['name' => $title]);
        $copy       = $this->driveService->files->copy($templateDocId, $copiedFile, [
            'supportsAllDrives' => true,
        ]);
        return $copy->getId();
    }

    private function replacePlaceholders(string $docId, array $data): void {
        $requests = [];
        foreach ($data as $placeholder => $value) {
            if ($placeholder === 'filename') continue;
            $requests[] = [
                'replaceAllText' => [
                    'containsText' => [
                        'text'      => '{{' . $placeholder . '}}',
                        'matchCase' => false,
                    ],
                    'replaceText' => (string) $value,
                ],
            ];
        }

        if (empty($requests)) return;

        $batchUpdateRequest = new Docs\BatchUpdateDocumentRequest(['requests' => $requests]);
        $this->docsService->documents->batchUpdate($docId, $batchUpdateRequest);
    }

    private function exportAsPdf(string $docId): string {
        $response = $this->driveService->files->export($docId, 'application/pdf', ['alt' => 'media']);
        return $response->getBody()->getContents();
    }

    private function uploadPdfToDrive(string $pdfContent, string $filename, string $folderId): DriveFile {
        $fileMetadata = new DriveFile([
            'name'    => $filename . '.pdf',
            'parents' => [$folderId],
        ]);

        return $this->driveService->files->create($fileMetadata, [
            'data'              => $pdfContent,
            'mimeType'          => 'application/pdf',
            'uploadType'        => 'multipart',
            'fields'            => 'id',
            'supportsAllDrives' => true,
        ]);
    }

    private function setPublicPermission(string $fileId): void {
        $permission = new Permission([
            'type' => 'anyone',
            'role' => 'reader',
        ]);
        $this->driveService->permissions->create($fileId, $permission, [
            'supportsAllDrives' => true,
        ]);
    }

    private function deleteDoc(string $docId): void {
        $this->driveService->files->delete($docId, [
            'supportsAllDrives' => true,
        ]);
    }
}
