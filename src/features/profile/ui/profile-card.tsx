"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { User } from "next-auth";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";
import { trpc } from "@/shared/api/trpc";
import { getInitials } from "@/shared/lib/get-initials";
import { useUploadThing } from "@/shared/lib/uploadthing";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/core/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
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

type Props = {
  user: User;
};

type ProfileFormValues = z.infer<typeof UpdateProfileSchema>;

export function ProfileCard({ user }: Props) {
  const { update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(user.image ?? "");

  const updateAvatar = trpc.user.updateAvatar.useMutation({
    onSuccess: async () => {
      toast.success("Profile Picture updated");
      await update();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeAvatar = trpc.user.removeAvatar.useMutation({
    onSuccess: async () => {
      setAvatarUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Photo removed");
      await update();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const { startUpload, isUploading } = useUploadThing("avatarUploader", {
    onClientUploadComplete: (res) => {
      const file = res[0];
      setAvatarUrl(file.ufsUrl);
      updateAvatar.mutate({ url: file.ufsUrl, key: file.key });
    },
    onUploadError: (error: Error) => {
      let message = "Error uploading file";
      if (error.message.includes("FileSizeMismatch")) {
        message = "File too large (max 4MB)";
      } else if (error.message.includes("InvalidFileType")) {
        message = "Invalid file format (allowed: .png, .jpg, .gif)";
      } else if (error.message.includes("Unauthorized")) {
        message = "You are not logged in";
      }
      toast.error(`${message}`);
    },
  });

  const updateProfile = trpc.user.updateUser.useMutation({
    onSuccess: async () => {
      toast.success("Data updated");
      await update();
      form.reset({
        name: form.getValues("name"),
        email: form.getValues("email"),
      });
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  React.useEffect(() => {
    updateProfile.reset();
    updateAvatar.reset();
    removeAvatar.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await startUpload([file]);
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(UpdateProfileSchema),
    values: {
      name: user.name ?? "",
      email: user.email ?? "",
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate({ name: values.name, email: values.email });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>This image will be displayed on your profile.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="border-border h-24 w-24 border-2">
              <AvatarImage src={avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="text-2xl">
                {getInitials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            {avatarUrl && !updateAvatar.isPending && (
              <LoadingButton
                size="icon"
                variant="destructive"
                className="absolute right-0 bottom-0 cursor-pointer"
                disabled={removeAvatar.isPending}
                onClick={() => removeAvatar.mutate()}
                isLoading={removeAvatar.isPending}
                loadingText=""
              >
                <Trash2 className="h-4 w-4" />
              </LoadingButton>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept=".jpg, .jpeg, .png, .gif"
              onChange={handleImageSelect}
              disabled={isUploading}
            />

            <LoadingButton
              className="cursor-pointer"
              variant="outline"
              loadingText="Loading..."
              isLoading={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload photo
            </LoadingButton>

            <p className="text-muted-foreground text-center text-xs">Max. 4MB (.jpg, .png, .gif)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your name.</CardDescription>
          {/* <CardDescription>Update your name or email.</CardDescription> */}
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-muted-foreground">Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
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
                  loadingText="Saving..."
                  isLoading={updateProfile.isPending}
                  disabled={
                    !form.formState.isDirty || !form.formState.isValid || updateProfile.isPending
                  }
                  className="cursor-pointer"
                >
                  Save
                </LoadingButton>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
