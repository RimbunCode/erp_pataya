import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Dialog, DialogTrigger } from "@/Components/ui/dialog";
import {
  FormPage,
  FormPageContent,
  FormPageSidebar,
} from "@/Pages/Core/FormPage";
import React, { Fragment, useMemo, useState } from "react";
import { SaveIcon, Trash2, UploadIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import { Button } from "@/Components/ui/button";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import UploadDialog from "@/Pages/Core/Components/UploadDialog";
import { useDraftFrom } from "@/Hooks/useDraftFrom";
import { useForm } from "@inertiajs/react";

function Edit({ user }) {
  const { data, setData, put, processing, errors, reset, isDirty } =
    useDraftFrom("user", user);
  const route = window.route;
  const [openAttachment, setOpenAttachment] = useState(false);
  const alias = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");
  const avatar = useMemo(() => {
    console.log("check");
    return (
      <AvatarImage
        src={
          route("files.show", user.image) +
          `?v=${new Date(user.updated_at).getTime()}`
        }
        alt={user.name}
        className=" transition-[filter] group-hover:blur-sm"
      />
    );
  }, []);
  return (
    <FormPage
      className="overflow-hidden"
      title={user.name}
      badge={
        isDirty && <span className="text-sm badge warning">Not Saved</span>
      }
      controls={
        <Button className="!p-2 size-fit h-8">
          <SaveIcon />
          Save
        </Button>
      }
    >
      <FormPageSidebar>
        {(defaultComp) => (
          <>
            <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
              <Avatar className="relative w-full h-auto border rounded-xl aspect-square max-w-64 group">
                {avatar}
                <AvatarFallback className="rounded-lg ">
                  <p className="w-full font-semibold text-center text-muted-foreground text-9xl  transition-[filter]">
                    {alias}
                  </p>
                </AvatarFallback>
                <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button variant="default" size="icon">
                          <UploadIcon className="!size-5" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent align="center">Upload</TooltipContent>
                  </Tooltip>
                  {user.image && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon">
                          <Trash2 className="!size-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent align="center">Remove</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </Avatar>
              <UploadDialog
                open={openAttachment}
                imageOnly
                options={{
                  route: route(route().current(), route().params) + "/image",
                  reset: ["user"],
                }}
                onClose={() => {
                  setOpenAttachment(false);
                }}
              />
            </Dialog>
            {defaultComp}
          </>
        )}
      </FormPageSidebar>
      <FormPageContent title="Basic Info" value="basic_info">
        {/* <FormPageTitle>Test</FormPageTitle>
        <FormPageDescription>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Dolore,
          maiores.
        </FormPageDescription> */}
        <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <FormInput label="Email" required={true}>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => setData("email", e.target.value)}
            />
          </FormInput>
          <FormInput label="Username" required={true}>
            <Input
              value={data.username}
              onChange={(e) => setData("username", e.target.value)}
            />
          </FormInput>
          <FormInput label="Full Name" required={true}>
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput label="Gender">
            <Select
              value={data.gender}
              onValueChange={(val) => setData("gender", val)}
            >
              <SelectTrigger className="">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </FormInput>
          <FormInput label="Mobile No">
            <Input
              type="text"
              value={data.phone}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
          <FormInput label="Birth Date">
            <DatetimePicker
              type="date"
              value={data.birthdate}
              onValueChange={(val) => setData("birthdate", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent title="Role & Permissions" value="roles_and_permissions">
        Password
      </FormPageContent>
    </FormPage>
  );
}

export default Edit;
