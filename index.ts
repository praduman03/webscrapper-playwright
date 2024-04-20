import { chromium, Browser, Page } from "playwright";
import { sequelize, BabyModel } from "./db/db.connect.js";
import fetch from "node-fetch";
import JSZip from "jszip";
import csvParser from "csv-parser";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const kaggleUsername = "prad12399";
const kagglePassword = process.env.KAGGLEPASSWORD;

type Data = {
  name: string;
  sex: string;
};

async function readData(): Promise<Data[]> {
  const filename = "./CSVFile/babyNamesUSYOB-mostpopular.csv";
  return new Promise((resolve, reject) => {
    let batch: Data[] = [];
    // Read the CSV file and insert data into the batch array
    fs.createReadStream(filename)
      .pipe(csvParser())
      .on("data", async (row) => {
        batch.push({
          name: row.Name,
          sex: row.Sex,
        });
      })
      .on("end", async () => {
        resolve(batch);
      })
      .on("error", async (error: any) => {
        reject(error);
      });
  });
}

async function insertDataInDB(data: Data[]): Promise<void> {
  try {
    let start = 0;
    let end = 1000;

    while (start < data.length) {
      const batch = data.slice(start, end);
      await BabyModel.bulkCreate(batch);
      console.log(`Inserted ${start + end} no of data in db`);
      start = end;
      end = start + 1000;
    }
    console.log("All Data inserted Successfully");
  } catch (error) {
    console.log("Error while inserting data in db", error);
  }
}

type BabyData = {
  id: number;
  name: string;
  sex: string;
};

async function fetchDatafromDB(): Promise<BabyData[]> {
  return new Promise<BabyData[]>((resolve, reject) => {
    BabyModel.findAll()
      .then((data: any) => {
        const extractedData = data.map((entry: any) => entry.dataValues);
        console.log(extractedData);
        resolve(extractedData);
      })
      .catch((error: any) => {
        reject(error);
      });
  });
}

async function extractZipFile(fileUrl: string): Promise<void> {
  const zipData = await fs.promises.readFile(fileUrl);
  const zip = await JSZip.loadAsync(zipData);
  await Promise.all(
    Object.keys(zip.files).map(async (filename) => {
      const file = zip.files[filename];
      const content = await file.async("nodebuffer");
      const filePath = `./CSVFile/${filename}`;
      await fs.promises.writeFile(filePath, content);
    })
  );
  console.log("extracted files from zip successfully");
}

async function signInToKaggle(): Promise<void> {
  const browser: Browser = await chromium.launch({
    headless: true,
    downloadsPath: "./CSVFile",
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page: Page = await context.newPage();

  try {
    await page.goto("https://www.kaggle.com/");
    await page.waitForSelector(
      "#site-container > div > div.sc-cHWeeV.sc-gHRYGD.ccMIOQ.eXbFrn > div > div.sc-ebERcF.ySNIq > div.sc-iqziPC.gJSBDX > div:nth-child(1) > a > button"
    );
    //click on login button
    await page.click(
      "#site-container > div > div.sc-cHWeeV.sc-gHRYGD.ccMIOQ.eXbFrn > div > div.sc-ebERcF.ySNIq > div.sc-iqziPC.gJSBDX > div:nth-child(1) > a > button"
    );
    //click signin using email
    await page.click(
      "#site-content > div:nth-child(2) > div > div > div.sc-eyfLJd.kBeVzM > form > div > div > div.sc-hwFxst.ddBfgQ > button:nth-child(2)"
    );
    await page.fill('input[name="email"]', kaggleUsername);
    await page.fill('input[name="password"]', "kagglepasswordfortesting");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto(
      "https://www.kaggle.com/datasets/thedevastator/us-baby-names-by-year-of-birth?select=babyNamesUSYOB-full.csv"
    );
    const downloadFile = page.waitForEvent("download");
    await page.click(
      "#site-content > div:nth-child(2) > div > div.sc-AngWr.jxhegR > div > div.sc-jSDDAQ.hRELuv > div.sc-cIAOVF.hwLqIM > div > div.mdc-menu-surface--anchor > div.sc-emfenM.sc-fnpAPw.cvuSKw.gzjyQr > a > button"
    );
    const download = await downloadFile;
    await download.saveAs("./CSVFile/" + download.suggestedFilename());

    await browser.close();
  } catch (error) {
    console.error("Error during playwright:", error);
  }
}

async function postDataToHubspot(data: any): Promise<void> {
  const result = [];
  let i = 0;
  while (i < 5) {
    const { name, sex } = data[i];
    result.push({
      email: name + "@gmail.com",
      properties: [
        { property: "firstname", value: name },
        { property: "gender", value: sex },
      ],
    });
    i++;
    fetch("https://api.hubapi.com/contacts/v1/contact/batch/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer " + process.env.HUBSPOT_API_KEY,
      },
      body: JSON.stringify(result),
    })
      .then((res) => {
        console.log(res.statusText, res.status);
      })
      .catch((error) => {
        console.log(error);
      });
  }
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log(
      "Connection to the database has been established successfully."
    );
    await signInToKaggle();
    await extractZipFile("./CSVFile/archive.zip");
    const data = await readData();
    await insertDataInDB(data);
    const newData = await fetchDatafromDB();
    await postDataToHubspot(newData);
  } catch (error) {
    console.error("error:", error);
  }
})();
