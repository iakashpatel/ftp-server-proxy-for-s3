require("dotenv").config();
const express = require("express");
const { JsonDB, Config } = require("node-json-db");

var db = new JsonDB(new Config("users", true, false, "/"));

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post("/users", async (req, res) => {
  const { username, password } = req.body;
  await db.push(`/${username}`, password);
  return res.status(201).send({ success: true });
});

app.delete("/users", async (req, res) => {
  const { username } = req.body;
  await db.delete(`/${username}`);
  return res.status(204).send({ success: true });
});

app.get("/users", async (req, res) => {
  const data = await db.getData("/");
  return res.send({
    data,
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
