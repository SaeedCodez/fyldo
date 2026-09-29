declare module 'gettext-parser' {
  const gettext: {
    po: {
      parse(input: Buffer | string): { headers: Record<string, string>; translations: Record<string, Record<string, unknown>> };
      compile(data: unknown): Buffer;
    };
    mo: { compile(data: unknown): Buffer };
  };
  export default gettext;
}
