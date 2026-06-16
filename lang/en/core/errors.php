<?php

return [
    'http' => [
        'default' => 'An error occurred while processing your request.',
        400       => 'Invalid request. Please check the submitted data.',
        401       => 'Your session has expired or you are not logged in. Please log in again.',
        403       => 'You do not have permission to perform this action.',
        404       => 'The requested data or page was not found.',
        405       => 'The request method is not allowed for this endpoint.',
        409       => 'A data conflict occurred. Please reload the page and try again.',
        419       => 'The page has expired. Please refresh and try again.',
        422       => 'Invalid data. Please review your input.',
        429       => 'Too many requests. Please try again in a moment.',
        500       => 'An internal server error occurred.',
        502       => 'The upstream server is having issues.',
        503       => 'The service is temporarily unavailable.',
        504       => 'The server request timed out.',
    ],
    'network' => [
        'title'       => 'Connection failed',
        'description' => 'Unable to reach the server. Please check your connection.',
    ],
    'fetch_failed' => 'Failed to load data. Please try again.',
];
