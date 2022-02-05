const util = require("util");
const timer = util.promisify(setTimeout);
const got = require("got");

class CaptchaSolver {
  constructor(capMonKey, siteKey) {
    this.apiKey = capMonKey;
    this.siteKey = siteKey;
    this.baseApiUrl = "https://api.capmonster.cloud";
    this.createTaskPath = "/createTask";
    this.getResultPath = "/getTaskResult";
  }

  async solve(url) {
    this.v3 = false;
    this.websiteURL = url;
    const taskId = await this.createTask();

    return this.pollResult(taskId);
  }

  async solveV3(url) {
    this.v3 = true;
    this.websiteURL = url;
    const taskId = await this.createTask();

    return this.pollResult(taskId);
  }

  async pollResult(taskId) {
    let result;
    const url = `${this.baseApiUrl}${this.getResultPath}`;
    const payload = {
      clientKey: this.apiKey,
      taskId,
    };

    while (!result) {
      console.log("Solving captcha...");
      await timer(10000);

      try {
        const res = await got.post(url, {
          json: payload,
          responseType: "json",
        });

        if (res && res.body && res.body.status === "ready") {
          result = res.body.solution.gRecaptchaResponse;
        }
      } catch (e) {
        console.log(e.toString());
      }
    }

    return result;
  }

  async createTask() {
    const payload = {
      clientKey: this.apiKey,
      task: {
        type: "NoCaptchaTaskProxyless",
        websiteURL: this.websiteURL,
        websiteKey: this.siteKey,
      },
    };

    if (this.v3) {
      payload.task.type = "RecaptchaV3TaskProxyless";
      payload.task.minScore = "0.3";
    }

    const url = `${this.baseApiUrl}${this.createTaskPath}`;

    try {
      const res = await got.post(url, { json: payload, responseType: "json" });
      const task = res.body;

      return task.taskId;
    } catch (e) {
      console.log(e.toString());
    }
  }
}

module.exports = CaptchaSolver;
