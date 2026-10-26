"use client";

import { useEffect } from "react";
import { type UpdateProfileInput, UpdateProfileSchema } from "@doxynix/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, User2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import type { User } from "@/shared/lib/auth-client";
import { deriveDefaultName } from "@/shared/lib/default-name";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useProfileActions } from "../model/use-profile-actions";

type Props = {
  user: User;
};

export function ProfileDetailsForm({ user }: Readonly<Props>) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const initialName = user.name.trim() || deriveDefaultName(user.email);

  const form = useForm<UpdateProfileInput>({
    defaultValues: {
      email: user.email,
      name: initialName,
    },
    mode: "onChange",
    resolver: zodResolver(UpdateProfileSchema),
  });

  useEffect(() => {
    form.reset({
      email: user.email,
      name: initialName,
    });
  }, [initialName, user.email, form]);

  const { updateProfile } = useProfileActions({
    onProfileUpdateSuccess: (data) => {
      form.reset({
        email: data.email ?? "",
        name: data.name ?? "",
      });
    },
  });

  const onSubmit = (values: UpdateProfileInput) => {
    updateProfile.mutate(values);
  };

  const { isDirty, isValid } = form.formState;

  return (
    <Form {...form}>
      <form
        className="flex w-full flex-col gap-4"
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-muted-foreground">
                {t("settings_profile_personal_information_label")}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <User2 className="absolute top-2.5 left-3 text-muted-foreground" />
                  <Input
                    className="pl-9 text-sm sm:text-base"
                    disabled={updateProfile.isPending}
                    placeholder={t("settings_profile_personal_information_placeholder")}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-muted-foreground">
                {t("settings_profile_email_label")}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute top-2.5 left-3 text-muted-foreground" />
                  <Input
                    {...field}
                    className="pl-9 text-sm sm:text-base"
                    disabled
                    placeholder={t("settings_profile_email_placeholder")}
                  />
                  <Lock className="absolute top-2.5 right-3 text-muted-foreground" />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <LoadingButton
            disabled={!isDirty || !isValid || updateProfile.isPending}
            isLoading={updateProfile.isPending}
          >
            {tCommon("save")}
          </LoadingButton>
        </div>
      </form>
    </Form>
  );
}
