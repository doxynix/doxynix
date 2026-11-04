import { MessageCode } from "@doxynix/shared";

import { AppError, toErrorResponse } from "@/server/core/api-error";

const notFound = () => {
  return toErrorResponse(
    new AppError({
      code: "NOT_FOUND",
      messageCode: MessageCode.NOT_FOUND,
      publicMessage: "Not found",
    }),
  );
};

export {
  notFound as DELETE,
  notFound as GET,
  notFound as HEAD,
  notFound as OPTIONS,
  notFound as PATCH,
  notFound as POST,
  notFound as PUT,
};
