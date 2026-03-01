import { App } from "../app";
import { nullLogger } from "../logger";

describe("App Smoke Test", () => {
  it("should be able to instantiate App with empty config", () => {
    const config = {
      lsps: [],
    };
    const app = new App(config, nullLogger);
    expect(app).toBeDefined();
  });
});
