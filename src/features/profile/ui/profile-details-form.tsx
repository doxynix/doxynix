"use client";

import React, { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "next-auth";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import type z from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";
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

type ProfileFormValues = z.infer<typeof UpdateProfileSchema>;

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

  const form = useForm<ProfileFormValues>({
    defaultValues: {
      email: user.email ?? "",
      name: user.name ?? "",
    },
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

  const onSubmit = (values: ProfileFormValues) => {
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
                <Input
                  disabled={updateProfile.isPending}
                  placeholder={t("settings_profile_personal_information_placeholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* <FormField
                   control={form.control}
                   name="email"
                   render={({ field }) => (
                     <FormItem className="flex flex-col">
                       <FormLabel className="text-muted-foreground">Email</FormLabel>
                       <FormControl>
                         <div className="relative">
                           <Input {...field} className="text-sm sm:text-base" placeholder="Your email" />
                         </div>
                       </FormControl>
                     </FormItem>
                   )}
                 /> */}
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
