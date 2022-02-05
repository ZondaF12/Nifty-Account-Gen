const got = require("got");
const csv = require("csvtojson");
const fsp = require("fs").promises;
const tunnel = require("tunnel");
const Chance = require("chance");
const colors = require("colors");
const arrayToTxtFile = require("array-to-txt-file");
const figlet = require("figlet");
const prompts = require("prompts");
const util = require("util");
const printText = util.promisify(figlet.text);
const CaptchaSolver = require("./CaptchaSolver");
const config = require("./config");
const { ImapFlow } = require("imapflow");
const qs = require("qs");
const pino = require("pino")();
const { CookieJar } = require("tough-cookie");
const helper = require("csvtojson");
pino.level = "error";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const mergedConfig = Object.assign(config.emailConfig, {
  logger: pino,
});

const client = new ImapFlow(mergedConfig);
let counter = 0;
let counterCreated = 0;
let counterVerified = 0;
let chance = new Chance();
let saveToTxt = [];
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const pattern = new RegExp(/ code is: \d{1,6}/);

const captchaSolver = new CaptchaSolver(
  config.capMonsterKey,
  config.niftyCaptchaKey
);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

(async function start() {
  await home();
})();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function home() {
  const font = (await fsp.readFile("./store/Standard.flf")).toString();
  figlet.parseFont("Standard", font);

  const title = await printText("Nifty Bot", {
    font: "Standard",
    horizontalLayout: "default",
    verticalLayout: "default",
    width: 100,
    whitespaceBreak: true,
  });

  console.log(title.green);

  await options();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function options() {
  const response = await prompts([
    {
      type: "select",
      name: "value",
      message: "Please choose an option",
      choices: [
        {
          title: "Generate Accounts",
          description: "Generate Accounts for Nifty Gateway",
          value: 0,
        },
        {
          title: "Verify Accounts",
          description: "Verify Nifty Gateway Accounts",
          value: 1,
        },
        { title: "Submit Entries", value: 2, disabled: true },
      ],
      initial: 0,
      hint: "- Arrows to select. Return to submit",
    },
  ]);

  switch (response.value) {
    case 0:
      await generateAccounts();
      await delay(3000);
      // console.clear();
      return home();
    case 1:
      await verifyAccounts();
      await delay(3000);
    // console.clear();
    // return home();
    case 2:
      return home();
  }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function readCSV(filePath) {
  return csv().fromFile(filePath);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function generateAccounts() {
  const tasks = await readCSV("profiles.csv");
  counter = 0;
  console.clear();

  for (let i = 0; i < tasks.length; i++) {
    counter++;
    await init(tasks[i]);
  }
  console.log(
    `Successfully wrote ${counterCreated} created accounts to CSV`.cyan
  );
  arrayToTxtFile(saveToTxt, "./completed-accounts.txt", (err) => {
    if (err) {
      console.error(err);
      return;
    }
  });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function init(task) {
  const userAgents = await loadUserAgents();
  const userAgent = getRandomElement(userAgents);
  const proxies = await loadProxies();
  const proxyStr = getRandomElement(proxies);
  const proxyAgent = getAgent(proxyStr);
  const jar = new CookieJar();

  console.log(`Creating Account ${counter}!`.green);

  const token = await captchaSolver.solve(
    "https://niftygateway.com/new-signup"
  );

  const tokenv3 = await captchaSolver.solveV3(
    "https://niftygateway.com/new-signup"
  );

  const headers = {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "content-type": "application/json;charset=UTF-8",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent": userAgent,
    "x-castle-client-id":
      "QkJ-bzTdAOlNAePfYfwcFgYG3Bto6JPmhb-u9ZK7wJur-efr1pkidQKGiO2zuJv_wUKhuoJNamTp6abte0IVqo7BwYbL0d-c6tLE2rOQldWu6cyb4tHShqbw8dW3jovFvZ7ynOiIkc6mxpPBr57khfbSwKLj3O6c8pGQxrGQlsOmlu690vPp2abSzJ7jnuKQ5dXK3Kb9zYfp08Dav4-LxaiKkcK0kJTHsp72lODf15ypi5bCqI2TmY6MlpCy2MTH58mm8g2-Mf3l28GT5IiQxxrq5LvB8uDVrvDzvML35Nmm8PO8wvfk1cHb45r03cDV1Or91bWOksWm-syH493RxsKPlNXwzfrA2Y6FhfXhkKq2koWxtfqUxKuNldu2kJTBqImUxLeXAeG2j4rFt5GUzLGOidW2j5_FtoSVxW--OvUoBxH1UW8Vj0B9EV8yEA55KRkfkDzb6rvGf6X1hr51PT0lGU_f9fm-3e8RQSQc4bFh5v1A8baldoa-vvV5",
  };

  let payload = {};

  if (task.email.indexOf("random") > -1) {
    let emails = task.email.split("@");
    let domain = emails[1];
    let firstName = chance.first();
    let lastName = chance.last();
    let randomNumber = Math.floor(Math.random() * 100);

    randomEmail = `${firstName + lastName}@${domain}`;
    userName = firstName + lastName + randomNumber;
    fullName = firstName + " " + lastName;

    payload = {
      captcha_token: token,
      captcha_token_v3: tokenv3,
      email: randomEmail,
      password: task.password,
      username: userName,
      name: fullName,
      subscribe: true,
      referral: null,
    };
  } else {
    payload = {
      captcha_token: token,
      captcha_token_v3: tokenv3,
      email: task.email,
      name: task.name,
      password: task.password,
      referral: null,
      subscribe: true,
      username: task.username,
    };
  }

  let res;

  try {
    console.log(payload);
    res = await got.post("https://api.niftygateway.com/users/signup/", {
      headers,
      json: payload,
      agent: proxyAgent,
      cookieJar: jar,
    });
  } catch (e) {
    console.error(e.toString());
    return;
  }

  console.log(`Account ${counter} Created!`.magenta);
  counterCreated++;

  if (task.email.indexOf("random") > -1) {
    saveToTxt.push(`${randomEmail}, ${task.password}`);
  } else {
    saveToTxt.push(`${task.email}, ${task.password}`);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function startCardDetails() {} // TO DO

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function loadProxies() {
  const buffer = await fsp.readFile("./proxies.txt");
  return buffer.toString().split("\n");
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function loadUserAgents() {
  const buffer = await fsp.readFile("./user-agents.txt");
  return buffer.toString().split("\n");
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getAgent(proxyStr) {
  const [host, port, user, password] = proxyStr.split(":");

  const proxy = {
    host,
    port,
  };

  if (user && password) {
    proxy.proxyAuth = `${user}:${password}`;
  }

  return {
    https: tunnel.httpsOverHttp({
      proxy,
    }),
  };
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

////////////////////////////////////////////////////////////////////////////////////VERIFY ACCOUNTS////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function verifyAccounts() {
  const tasks = await readCSV("profiles.csv");
  counterVerified = 0;
  counter = 0;
  console.clear();

  for (let i = 0; i < tasks.length; i++) {
    counter++;
    await login(tasks[i]);
  }
  console.log(`Successfully verified ${counterVerified} accounts`.cyan);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function login(task) {
  const userAgents = await loadUserAgents();
  const userAgent = getRandomElement(userAgents);
  const proxies = await loadProxies();
  const proxyStr = getRandomElement(proxies);
  const proxyAgent = getAgent(proxyStr);
  const jar = new CookieJar();
  task.cookie = jar;

  console.log(`Logging into account ${counter}!`.green);

  // const tokenv3 = await captchaSolver.solveV3(
  //   "https://niftygateway.com/new-login"
  // );

  const headers = {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-GB,en;q=0.9",
    "content-type": "application/x-www-form-urlencoded",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "x-castle-client-id":
      "OzsHFk2keZA0eJqmGIVlb39_pVEUPznx8aja4uastIzf7pP8oo5b4vcJ1JrfseTkzKOWHvbm1RE9OL618bEsHkL22Z2W2pyNiMC9jpOG5MzCifm1m8e1jYXa8aymieDS3JnqwqXAv9TGkvGaxJ34wrPZoY6X_rSAucClzcea5szBn_HKueGFr76F8Y6bwrTCtcyyiZ2A8aGa276Pl4bo09yZ_9bGnuPMw5vlwqHIt4OAwP7XwZ7_0cTF2dDBzOWEk5uwlfGuWuJmobKHls-z1MebTbaz55aut4n5rKTglauzhfGspOCVq7OJloe0xqOBl4mDtqqJ4tLFmfGmm9u0gYaaldPDiaeRrZyO0tLZor3H9uHO0u3ipsOY_NHCh-HMw53_1cOY4MtWveHT3ZngzcOQ5tLeieHTyJnh2MKZOeJQqX9USqkAIUMhbFdGBH1JWdticUjDa4q855Eu8qnR4kYAZUuCAIGioumHrjNoYFO77CCysn_A9fK40eLCqS4",
  };

  const payload = {
    grant_type: "password",
    client_id: "PsXGrgaKodNkEhtSYFOL8klAD2M3TlO4VgNNFuug",
    password: task.password,
    username: task.email,
    // captcha_token_v3: tokenv3,
  };

  let res;

  const stringified = qs.stringify(payload);

  try {
    res = await got.post("https://api.niftygateway.com/o/token/", {
      headers,
      body: stringified,
      agent: proxyAgent,
      // cookieJar: task.cookie,
      responseType: "json",
    });

    console.log("Waiting for Login Code...".magenta);
  } catch (e) {
    console.error(e.toString());
  }

  // console.log(res.body);

  if (res && res.body) {
    if (res.body.didSucceed && res.body.data["twofa_token"]) {
      // console.log("working".red);
      let loginToken = res.body.data["twofa_token"];
      task.twofa_token = loginToken;
    }
  }

  const response = await prompts([
    {
      type: "toggle",
      name: "value",
      message: "Do you wish to proceed",
      initial: true,
      active: "yes",
      inactive: "no",
    },
  ]);

  if (response.value) {
    await delay(1000);
    await googleSignIn(task);
  } else {
    await delay(1000);
    console.clear();
    return home();
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function googleSignIn(task) {
  const email = task.email;
  let loginCode;
  // Wait until client connects and authorizes
  await client.connect();

  // Select and lock a mailbox. Throws if mailbox does not exist
  let lock = await client.getMailboxLock("INBOX");
  try {
    for await (let msg of client.fetch(
      { seen: false, all: true, from: "no-reply@niftygateway.com" },
      { source: true, envelope: true }
    )) {
      const source = msg.source.toString();
      const envelope = msg.envelope;

      if (envelope.to && envelope.to.length) {
        const address = envelope.to[0].address;

        if (email.includes(address)) {
          const match = source.match(pattern);

          if (match && match.length) {
            loginCode = match[0].substr(-6);
          }
        }
      }
    }
  } finally {
    // Make sure lock is released, otherwise next `getMailboxLock()` never returns
    lock.release();
  }

  await client.logout();
  await inputCode(loginCode, task);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function inputCode(loginCode, task) {
  const userAgents = await loadUserAgents();
  const userAgent = getRandomElement(userAgents);
  const proxies = await loadProxies();
  const proxyStr = getRandomElement(proxies);
  const proxyAgent = getAgent(proxyStr);

  console.log("Got 2FA Token!".green);

  const headers = {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-GB,en;q=0.9",
    "content-type": "application/x-www-form-urlencoded",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "x-castle-client-id":
      "OTkFC1qMU1WleFiR9QzZSuq5Ta0yxP2JQhxDmlUYLfRsWgqEETrPGsUlZYJ0G3aQBuFM1UXuhwsuSkuCvOH4xUliLOkMcjLzLXEptXQzeLppSiH0JXI_6WFTHLpwLWaqej0f8y8rfKFhZX6uaD0J6jFxLc0kfwPzNTJ9qXYze6xhNQPSFVAEtmFxIfEkPQ__InYns2FeIOgucC21eCxmqm8pfK1zM3modT0b-yd8OvNuKHutby5-9kkkeasneCytI2pLncod3JIgJHj7cHl-_N0PD_UueiT_YU4_8ydpG_IgeS3o5Ql4q24tebVwJH-qbT14q3steKBxLaCa5B36IvAdlULwa_Iq-6nhM-1t8TP4evH9EU0IUEEdSJr7qfIuLakb3BJbFsz5pfIgEFGhygHfR5xBEkiaUB23",
  };

  const payload = {
    token: task.twofa_token,
    code: loginCode,
  };

  const stringified = await qs.stringify(payload);

  let res;

  try {
    res = await got.post("https://api.niftygateway.com/o/twofa/", {
      headers,
      body: stringified,
      agent: proxyAgent,
      responseType: "json",
      // cookieJar: task.cookie,
    });
  } catch (e) {
    if (e.response.statusCode === 400) {
      console.log(
        "Could not find 2FA code! Please allow enough time for it to be received"
          .red
      );

      return;
    }
    console.error(e.toString());
  }

  console.log("Logged In!".green);

  const accessToken = await res.body.access_token;
  const refreshToken = await res.body.refresh_token;

  task.accessToken = accessToken;
  task.refreshToken = refreshToken;

  await buyActivationNumber(task);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function buyActivationNumber(task) {
  const token = config.smsConfig.sim5.apiKey;
  const country = "england";
  const operator = "any";
  const product = "nifty";

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let res;

  try {
    res = await got.get(
      `https://5sim.net/v1/user/buy/activation/${country}/${operator}/${product}`,
      {
        headers,
        responseType: "json",
      }
    );
  } catch (e) {
    console.error(e.toString());
  }

  if (res && res.body) {
    if (res.body.phone) {
      const phoneNumber = await res.body.phone;
      task.phoneNumber = phoneNumber;

      const numberId = await res.body.id;
      task.numberId = numberId;
    }
  }
  console.log("Got Phone Number!".green);

  await inputNumber(task);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function inputNumber(task) {
  const userAgents = await loadUserAgents();
  const userAgent = getRandomElement(userAgents);
  const proxies = await loadProxies();
  const proxyStr = getRandomElement(proxies);
  const proxyAgent = getAgent(proxyStr);

  console.log(`Inputting phone number ${task.phoneNumber}...`.magenta);

  const phoneNumber = `${task.phoneNumber.substring(
    0,
    7
  )} ${task.phoneNumber.substring(7, task.phoneNumber.length)}`;

  const headers = {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-GB,en;q=0.9",
    authorization: `Bearer ${task.accessToken}`,
    "content-type": "application/x-www-form-urlencoded",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "x-castle-client-id":
      "xMT4q3MkKGydgZFfCcnMvu0fD6h2qN2IIBVzmzcRHfUOUzqFczPymya0feMODE2dHR4_ZydbfGjshRfMIAyFZ5NLcORHZzX0WX0U90I7TbUTNFDMSnoc9FRnWNV3NEmrDSRDu3R9Fq0XL1jjFSBRu2JkCPdGQx35aH0MtBYnT7UQIlizaFws1m84WPdKfx27ZHEb8Ew9WNhLZhf2RjtBqg0kVq8XI0q1EiZMu3B1HvpRfVeuECNWqBV4cKkQcUz9QiYZ7CAT85u3HBv-R3IarRYm5M9iWj_XZjRQ1XVdPNJiOFjVdV080mI0P_5lewr4RjQqz3s0S6sUJFjfSmYd-FcnPKoSNA7ofCEnqwNkC8QWS0i3A1BL3xIlVagTOki1EiBWrBIlSbKHAEiqDCRJtBItT6sPNEiqGSRIoRMksJuTFMGblBSmQ5GCvpsjFHibIxR4m5l2wvq9ijhKIxR4m2NUONtjVCTLQ0Qgy5uswCNxXpvLY6d6mCMWeJssFIc",
  };

  const payload = {
    to: phoneNumber,
  };

  const stringified = qs.stringify(payload);

  let res;

  try {
    res = await got.post("https://api.niftygateway.com//user/verification/", {
      headers,
      body: stringified,
      agent: proxyAgent,
      // cookieJar: task.cookie,
    });
  } catch (e) {
    if (e.response.statusCode === 400) {
      console.log("Account already Verified!".blue);

      return;
    }
    console.error(e.toString());
  }
  await getVerifyCode(task);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function getVerifyCode(task) {
  const token = config.smsConfig.sim5.apiKey;
  const numberId = task.numberId;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let res;
  let smsCode;
  console.log("Waiting for SMS Code...".magenta);

  while (!smsCode) {
    await delay(10000);
    try {
      res = await got.get(`https://5sim.net/v1/user/check/${numberId}`, {
        headers,
        responseType: "json",
      });
    } catch (e) {
      console.error(e.toString());
    }
    if (res.body && Object.keys(res.body.sms).length != 0) {
      smsCode = res.body.sms[0].code;
      console.log("Got SMS Code!".green);
    }
  }

  // await poll5sim(numberId, token);
  await activateNumber(task, smsCode);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function activateNumber(task, smsCode) {
  const userAgents = await loadUserAgents();
  const userAgent = getRandomElement(userAgents);
  const proxies = await loadProxies();
  const proxyStr = getRandomElement(proxies);
  const proxyAgent = getAgent(proxyStr);

  const headers = {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-GB,en;q=0.9",
    authorization: `Bearer ${task.accessToken}`,
    "content-type": "application/x-www-form-urlencoded",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "x-castle-client-id":
      "BgY6NGWzbGqaR2euyjPmddWGcm3xJZ1JstyzWqXY3TScmvpE4fo_2jXllUKE24ZQ9iG8FbUud8veirtCTCEIBbmi3Cn8ssIz3bHZdYTziHqZitE01bLPKZGT7HqA7ZZqiv3vM9_rjGGRpY5umP35KsGx3Q3Uv_MzxfKNaYbzi2yR9fMS5ZD0dpGx0THU_f8_0rbXc5Ge0CjesN11iOyWap_pjG2D84lohf3rO9e8yjOe6Ittn-6ONrnkiWvXuNxt06q7XTrdLFLQ5Ig7gLmOPC3P_zXeutQ_kY7PM9ep6zLQud0oFcmIa57tiXWA5I9qnf2Ia4vtiGCB7XBaKd0MGgPduFoDjXpa8d34WrHduFoIsgE1-ZX46rHduFrxnfga8Z3gH-2Y5gwLZxX35JFYCvFsulux37hauN1H",
  };

  const payload = {
    code: smsCode,
  };

  const stringified = qs.stringify(payload);

  let res;

  try {
    res = await got.put("https://api.niftygateway.com//user/verification/", {
      headers,
      body: stringified,
      agent: proxyAgent,
      // cookieJar: task.cookie,
    });
  } catch (e) {
    console.error(e.toString());
  }
  console.log("Successfully Activated Account!".green);
  counterVerified++;
}
