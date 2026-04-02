declare module "openai" {
  class OpenAI {
    constructor(config?: { apiKey?: string });
  }
  export const APIError: Error;
  export default OpenAI;
}
