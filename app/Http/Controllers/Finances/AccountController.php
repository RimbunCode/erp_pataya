<?php

namespace App\Http\Controllers\Finances;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\AccountRequest;
use App\Models\Core\Currency;
use App\Models\Finances\Account;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AccountController extends Controller {
  public function __construct(Request $request) {
    parent::__construct($request, Account::class);
  }

  /**
   * Display a listing of the resource.
   */
  public function index(Request $request) {
    $this->setBreadcrumbs();
    Account::dataTable($request);

    return Inertia::render(
      'Finances/Accounts/Index',
      [],
    );
  }

  /**
   * Show the form for creating a new resource.
   */
  /**
   * Show the form for creating a new resource.
   */
  public function create() {
    $this->setBreadcrumbs('finance.accounts.new');

    $parentAccounts = Account::where('is_group', true)
      ->select('id', 'account_name', 'account_number')
      ->orderBy('account_number')
      ->get();

    $currencies = Currency::select('code', 'name')->get();

    return Inertia::render('Finances/Accounts/Show', [
      'parentAccounts' => $parentAccounts,
      'currencies'     => $currencies,
    ]);
  }

  /**
   * Store a newly created resource in storage.
   */
  public function store(AccountRequest $request) {
    $data = $request->validated();

    DB::beginTransaction();
    try {
      $data['parent_account_id'] = $data['parent_account']['id'];
      $data['currency_code']     = isset($data['currency']) ? $data['currency']['code'] : null;
      $parent_account            = Account::find($data['parent_account_id']);
      $data['root_type']         = $parent_account->root_type;
      $data['report_type']       = $parent_account->report_type;
      $account                   = Account::create($data);
      $account->logForCreated();
      DB::commit();
      return redirect()->route('accounts.show', $account)
        ->with('success', 'Account successfully created!');
    } catch (\Throwable $th) {
      DB::rollBack();
      throw $th;
    }
  }

  /**
   * Display the specified resource.
   */
  public function show(Account $account) {
    $this->setBreadcrumbs($account);
    $account->showDetail();

    return Inertia::render('Finances/Accounts/Show', [
      'account' => function () use ($account) {
        $account->loadRelations();

        return $account;
      },
    ]);
  }

  /**
   * Show the form for editing the specified resource.
   */
  public function edit(string $id) {
    //
  }

  /**
   * Update the specified resource in storage.
   */
  public function update(AccountRequest $request, Account $account) {
    $data = $request->validated();
    DB::beginTransaction();
    $data['parent_account_id'] = $data['parent_account']['id'];
    $data['currency_code']     = isset($data['currency']) ? $data['currency']['code'] : null;
    $parent_account            = Account::find($data['parent_account_id']);
    $data['root_type']         = $parent_account->root_type;
    $data['report_type']       = $parent_account->report_type;
    $account->fillForUpdate($data);
    $account->logForUpdated();
    DB::commit();
    return redirect()->back();
  }

  /**
   * Remove the specified resource from storage.
   */
  public function destroy(Account $account) {
    DB::beginTransaction();
    $account->logForDeleted();
    $account->delete();
    DB::commit();
    return redirect()->route('accounts.index');
  }
}
