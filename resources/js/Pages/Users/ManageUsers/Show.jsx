import { Button } from "@/Components/ui/button";
import FormPage from "@/Pages/Core/FormPage";
import FormPageContent from "@/Pages/Core/Components/FormPageContent";
import { SaveIcon } from "lucide-react";

function Show({ user }) {
  return (
    <FormPage
      className="overflow-hidden"
      title={user.name}
      controls={
        <Button className="!p-2 size-fit h-8">
          <SaveIcon />
          Save
        </Button>
      }
    >
      <FormPageContent title="User Details" value="user_details">
        Account
      </FormPageContent>
      <FormPageContent title="More Information" value="more_information">
        Password
      </FormPageContent>
      <FormPageContent title="More Information" value="more_information">
        Password
      </FormPageContent>
    </FormPage>
  );
}

export default Show;
