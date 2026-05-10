import { Button } from "@/Components/ui/button";

export default function DeleteUserForm({ className = "" }) {
  return (
    <section className={`space-y-6 ${className}`}>
      <header>
        <h2 className="text-lg font-medium text-foreground dark:text-foreground">
          Delete Account
        </h2>

        <p className="mt-1 text-sm text-foreground dark:text-muted-foreground">
          Once your account is deleted, all of its resources and data will be
          permanently deleted. Before deleting your account, please download any
          data or information that you wish to retain.
        </p>
      </header>

      <Button type="button">Delete Account</Button>

      {/* <Modal show={confirmingUserDeletion} onClose={closeModal}>
        <form onSubmit={deleteUser} className="p-6">
          <h2 className="text-lg font-medium text-foreground dark:text-foreground">
            Are you sure you want to delete your account?
          </h2>

          <p className="mt-1 text-sm text-foreground dark:text-muted-foreground">
            Once your account is deleted, all of its resources and data will be
            permanently deleted. Please enter your password to confirm you would
            like to permanently delete your account.
          </p>

          <div className="mt-6">
            <InputLabel
              htmlFor="password"
              value="Password"
              className="sr-only"
            />

            <TextInput
              id="password"
              type="password"
              name="password"
              ref={passwordInput}
              value={data.password}
              onChange={(e) => setData("password", e.target.value)}
              className="mt-1 block w-3/4"
              isFocused
              placeholder="Password"
            />

            <InputError message={errors.password} className="mt-2" />
          </div>

          <div className="mt-6 flex justify-end">
            <SecondaryButton onClick={closeModal}>Cancel</SecondaryButton>

            <DangerButton className="ms-3" disabled={processing}>
              Delete Account
            </DangerButton>
          </div>
        </form>
      </Modal> */}
    </section>
  );
}
