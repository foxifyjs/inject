declare module "*/package.json" {
  const pkg: {
    name: string;
    version: string;
  };

  export = pkg;
}
