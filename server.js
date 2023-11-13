const FtpSrv = require("ftp-srv");
const { uploadToS3 } = require("./s3Helper");

const hostname = "127.0.0.1";
const port = 2222;
const ftp_location_path = "./";

// Configure FTP Server
const ftpServer = new FtpSrv({
  url: "ftp://" + hostname + ":" + port,
  anonymous: true,
});

ftpServer.on("login", ({ connection, username, password }, resolve, reject) => {
  const users = require("./users.json");
  const isUserExists =
    Object.keys(users).filter(
      (item) => item === username && password === users[item]
    ).length === 1;

  if (isUserExists) {
    resolve({
      root: ftp_location_path,
    });
    connection.on("STOR", (error, fileName) => {
      if (error === null) {
        const s3FileName = "uploads/" + fileName.split("/").pop();
        uploadToS3(fileName, s3FileName);
      }
    });
  }
  return reject(new Error("Invalid username or password", 401));
});

ftpServer.on("client-error", (connection, context, error) => {
  console.log("connection: " + connection);
  console.log("context: " + context);
  console.log("error: " + error);
});

ftpServer.listen().then(() => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
