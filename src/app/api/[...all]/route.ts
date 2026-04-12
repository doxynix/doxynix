import { NextResponse } from "next/server";

const notFound = () => {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
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
