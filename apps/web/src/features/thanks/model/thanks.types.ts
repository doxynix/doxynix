export type Dependency = {
  license: string;
  name: string;
};

export type AuthorGroup = {
  author: string;
  authorLink: string;
  avatar: null | string;
  packages: Dependency[];
};
