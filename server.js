const http = require("http");
const https = require("https");

function get(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, { headers: { "User-Agent": "clima-bot" } }, function(res) {
      let data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on("error", reject);
  });
}

const server = http.createServer(async function(req, res) {
  try {
    const params = new URL(req.url, "http://localhost");
    let cidade = params.pathname.replace(/^\//, "");
    cidade = decodeURIComponent(cidade).replace(/\+/g, " ").replace(/-$/, "").replace(/-+/g, " ").trim();
    if (!cidade) {
      res.end("Use /NomeDaCidade");
      return;
    }

    const apiKey = "3a9be70b9ba044e3a81150545262206";

    // Busca sugestoes e filtra pelo Brasil
    const sugestoes = await get(
      "https://api.weatherapi.com/v1/search.json?key=" + apiKey +
      "&q=" + encodeURIComponent(cidade)
    );

    if (!Array.isArray(sugestoes) || sugestoes.length === 0) {
      res.end("Cidade nao encontrada: " + cidade);
      return;
    }

    const brasileira = sugestoes.find(function(s) {
      return s.country === "Brazil" || s.country === "Brasil";
    });

    if (!brasileira) {
      res.end("Cidade nao encontrada no Brasil: " + cidade);
      return;
    }

    // Busca clima pelo ID exato
    const data = await get(
      "https://api.weatherapi.com/v1/current.json?key=" + apiKey +
      "&q=id:" + brasileira.id + "&lang=pt"
    );

    if (data.error) {
      res.end("Erro: " + data.error.message);
      return;
    }

    const cond = data.current.condition.text.toLowerCase();
    let emoji = "\uD83C\uDF21\uFE0F";
    if (cond.indexOf("tempest") !== -1 || cond.indexOf("trovoad") !== -1) emoji = "\u26C8\uFE0F";
    else if (cond.indexOf("chuva") !== -1 || cond.indexOf("garoa") !== -1) emoji = "\uD83C\uDF27\uFE0F";
    else if (cond.indexOf("neve") !== -1 || cond.indexOf("granizo") !== -1) emoji = "\u2744\uFE0F";
    else if (cond.indexOf("nublado") !== -1 || cond.indexOf("encoberto") !== -1) emoji = "\u2601\uFE0F";
    else if (cond.indexOf("neblina") !== -1 || cond.indexOf("nevoa") !== -1) emoji = "\uD83C\uDF2B\uFE0F";
    else if (cond.indexOf("sol") !== -1 || cond.indexOf("claro") !== -1) emoji = "\u2600\uFE0F";
    else if (cond.indexOf("parcialmente") !== -1) emoji = "\uD83C\uDF24\uFE0F";

    res.end(
      emoji + " " + data.location.name + ", " + data.location.region + " | " +
      "\uD83C\uDF21\uFE0F " + data.current.temp_c + "C (sensacao " + data.current.feelslike_c + "C) | " +
      data.current.condition.text + " | " +
      "Umidade " + data.current.humidity + "% | " +
      "Vento " + data.current.wind_kph + " km/h"
    );
  } catch(e) {
    res.end("Erro interno: " + e.message);
  }
});

server.listen(process.env.PORT || 3000);
