"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, User2 } from "lucide-react";
import type { User } from "next-auth";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { UpdateProfileSchema, type UpdateProfileInput } from "@/shared/api/schemas/user";
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
  buttonText?: string;
  isWelcome?: boolean;
  loadingText?: string;
  onSuccess?: () => void;
  user: User;
};

export function ProfileDetailsForm({
  buttonText,
  isWelcome = false,
  loadingText,
  onSuccess,
  user,
}: Readonly<Props>) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const form = useForm<UpdateProfileInput>({
    defaultValues: {
      email: user.email ?? "",
      name: user.name ?? "",
    },
    mode: "onChange",
    resolver: zodResolver(UpdateProfileSchema),
  });

  useEffect(() => {
    form.reset({
      email: user.email ?? "",
      name: user.name ?? "",
    });
  }, [user, form]);

  const { updateProfile } = useProfileActions({
    onProfileUpdateSuccess: (data) => {
      form.reset({
        email: data.email ?? "",
        name: data.name ?? "",
      });
      onSuccess?.();
    },
  });

  const onSubmit = (values: UpdateProfileInput) => {
    updateProfile.mutate(values);
  };

  const { isDirty, isValid } = form.formState;

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="flex w-full flex-col gap-4"
      >
        <FormField
          name="name"
          control={form.control}
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-muted-foreground">
                {t("settings_profile_personal_information_label")}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <User2 className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                  <Input
                    disabled={updateProfile.isPending}
                    placeholder={t("settings_profile_personal_information_placeholder")}
                    className="pl-9 text-sm sm:text-base"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="email"
          control={form.control}
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-muted-foreground">Email</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                  <Input
                    {...field}
                    disabled
                    placeholder="Your email"
                    className="pl-9 text-sm sm:text-base"
                  />
                  <Lock className="text-muted-foreground absolute top-2.5 right-3 size-4" />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <LoadingButton
            disabled={(!isWelcome && !isDirty) || !isValid || updateProfile.isPending}
            isLoading={updateProfile.isPending}
            loadingText={loadingText ?? "Saving..."}
            className="cursor-pointer"
          >
            {buttonText ?? tCommon("save")}
          </LoadingButton>
        </div>
      </form>
    </Form>
  );
}
