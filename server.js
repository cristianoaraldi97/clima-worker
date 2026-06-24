import express from "express";
import handler from "./api/clima.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/clima", (req, res) => {
  handler(req, res);
});

app.get("/", (req, res) => {
  res.send("clima-worker is running");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server listening on port " + PORT);
});
