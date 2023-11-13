require("dotenv").config();
const AWS = require("aws-sdk");
const fs = require("fs");

// Configs
const s3BucketName = process.env.s3BucketName;

// Setup AWS S3 Connection
AWS.config.update({
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey,
});

const s3 = new AWS.S3();
const chunkSize = 10 * 1024 * 1024; // 10MB

// Utility function which can cleanup file after it is uploaded to s3
const deleteFile = (filePath) => {
  if (filePath) {
    fs.unlinkSync(filePath);
    console.log("Deleted: ", filePath);
  }
};

/**
 *
 * @param {string} fileName the name in S3
 * @param {string} filePath the absolute path to our local file
 * @return the final file name in S3
 */

async function uploadToS3(filePath, remotePath) {
  if (!remotePath) {
    throw new Error("the remotePath is empty");
  }
  if (!filePath) {
    throw new Error("the file absolute path is empty");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`file does not exist: ${filePath}`);
  }

  const statsFile = fs.statSync(filePath);
  console.info(`file size: ${Math.round(statsFile.size / 1024 / 1024)}MB`);

  //  Each part must be at least 5 MB in size, except the last part.
  let uploadId;
  try {
    const params = {
      Bucket: s3BucketName,
      Key: remotePath,
    };
    const result = await s3.createMultipartUpload(params).promise();
    uploadId = result.UploadId;
    console.info(
      `csv ${remotePath} multipart created with upload id: ${uploadId}`
    );
  } catch (e) {
    throw new Error(`Error creating S3 multipart. ${e.message}`);
  }

  const readStream = fs.createReadStream(filePath); // you can use a second parameter here with this option to read with a bigger chunk size than 64 KB: { highWaterMark: chunkSize }

  // read the file to upload using streams and upload part by part to S3
  const uploadPartsPromise = new Promise((resolve, reject) => {
    const multipartMap = { Parts: [] };

    let partNumber = 1;
    let chunkAccumulator = null;

    readStream.on("error", (err) => {
      reject(err);
    });

    readStream.on("data", (chunk) => {
      // it reads in chunks of 64KB. We accumulate them up to 10MB and then we send to S3
      if (chunkAccumulator === null) {
        chunkAccumulator = chunk;
      } else {
        chunkAccumulator = Buffer.concat([chunkAccumulator, chunk]);
      }
      if (chunkAccumulator.length > chunkSize) {
        // pause the stream to upload this chunk to S3
        readStream.pause();

        const chunkMB = chunkAccumulator.length / 1024 / 1024;

        const params = {
          Bucket: s3BucketName,
          Key: remotePath,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: chunkAccumulator,
          ContentLength: chunkAccumulator.length,
        };
        s3.uploadPart(params)
          .promise()
          .then((result) => {
            console.info(
              `Data uploaded. Entity tag: ${result.ETag} Part: ${params.PartNumber} Size: ${chunkMB}`
            );
            multipartMap.Parts.push({
              ETag: result.ETag,
              PartNumber: params.PartNumber,
            });
            partNumber++;
            chunkAccumulator = null;
            // resume to read the next chunk
            readStream.resume();
          })
          .catch((err) => {
            console.error(`error uploading the chunk to S3 ${err.message}`);
            reject(err);
          });
      }
    });

    readStream.on("end", () => {
      console.info("End of the stream");
    });

    readStream.on("close", () => {
      console.info("Close stream");
      if (chunkAccumulator) {
        const chunkMB = chunkAccumulator.length / 1024 / 1024;

        // upload the last chunk
        const params = {
          Bucket: s3BucketName,
          Key: remotePath,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: chunkAccumulator,
          ContentLength: chunkAccumulator.length,
        };

        s3.uploadPart(params)
          .promise()
          .then((result) => {
            console.info(
              `Last Data uploaded. Entity tag: ${result.ETag} Part: ${params.PartNumber} Size: ${chunkMB}`
            );
            multipartMap.Parts.push({
              ETag: result.ETag,
              PartNumber: params.PartNumber,
            });
            chunkAccumulator = null;
            resolve(multipartMap);
          })
          .catch((err) => {
            console.error(
              `error uploading the last csv chunk to S3 ${err.message}`
            );
            reject(err);
          });
      }
    });
  });

  const multipartMap = await uploadPartsPromise;
  console.info(
    `All parts have been upload. Let's complete the multipart upload. Parts: ${multipartMap.Parts.length} `
  );

  // gather all parts' tags and complete the upload
  try {
    const params = {
      Bucket: s3BucketName,
      Key: remotePath,
      MultipartUpload: multipartMap,
      UploadId: uploadId,
    };
    const result = await s3.completeMultipartUpload(params).promise();
    console.info(`Upload multipart completed. Entity tag: ${result.ETag}`);
  } catch (e) {
    throw new Error(`Error completing S3 multipart. ${e.message}`);
  }

  deleteFile(filePath);
  return remotePath;
}

module.exports = {
  uploadToS3,
};
