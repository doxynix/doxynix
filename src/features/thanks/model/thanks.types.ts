export type Dependency = {
  license: string;
  link: string;
  name: string;
};

export type AuthorGroup = {
  author: string;
  authorLink: string;
  avatar: string | null;
  packages: Dependency[];
};
