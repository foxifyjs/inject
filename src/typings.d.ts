declare module "*/package.json" {
  const package: {
    name: string
    version: string
  }

  export = package
}

declare module "readable-stream"
