import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type MetadataProps = {
  params: Promise<{ locale: string }>;
};

export function createMetadata(titlekey: string, descriptionKey: string) {
  return async ({ params }: MetadataProps): Promise<Metadata> => {
    const { locale } = await params;

    const t = await getTranslations({ locale, namespace: "Metadata" });

    return {
      title: t(titlekey),
      description: t(`${descriptionKey}`),
    };
  };
}
