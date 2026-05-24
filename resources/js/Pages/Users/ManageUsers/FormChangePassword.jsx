import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import FormInput from "@/Components/FormInput";
import PasswordChecker from "@/Components/PasswordChecker";
import PasswordInput from "@/Components/PasswordInput";
import { useState } from "react";

function FormChangePassword() {
  const { data, setData } = useFormPage({
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [isVisible, setIsVisible] = useState(false);
  return (
    <FormPageContent value="change-password">
      <div className="grid grid-cols-1 gap-y-4">
        <FormInput name="password" required={true} label="Current Password">
          <PasswordInput
            autoComplete="off"
            value={data.current_password}
            onValueChange={(val) => setData("current_password", val)}
          />
        </FormInput>
        <div>
          <FormInput name="new_password" required={true} label="New Password">
            <PasswordInput
              autoComplete="off"
              visible={isVisible}
              onVisibleChange={setIsVisible}
              value={data.password}
              onValueChange={(val) => setData("password", val)}
            />
          </FormInput>
          <PasswordChecker password={data.password} />
        </div>
        <FormInput
          name="password_confirmation"
          autoComplete="off"
          required={true}
          label="Password Confirmation"
        >
          <PasswordInput
            autoComplete="off"
            visible={isVisible}
            onVisibleChange={setIsVisible}
            value={data.password_confirmation}
            onValueChange={(val) => setData("password_confirmation", val)}
          />
        </FormInput>
      </div>
    </FormPageContent>
  );
}

export default FormChangePassword;
