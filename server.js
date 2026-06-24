const http = require("http");
const https = require("https");

function get(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, { headers: { "User-Agent": "clima-bot" } }, function(res) {
      let data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() { resolve(JSON.parse(data)); });
    }).on("error", reject);
  });
}

function normaliza(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const server = http.createServer(async function(req, res) {
  try {
    const params = new URL(req.url, "http://localhost");

    // Aceita tanto /Curitiba quanto /?cidade=Curitiba
    let cidade = params.searchParams.get("cidade") || "";
    if (!cidade) {
      cidade = params.pathname.replace(/^\//, "");
    }

    cidade = decodeURIComponent(cidade).replace(/\+/g, " ");
    cidade = cidade.split(" ").filter(function(p) { return p.indexOf("$(") !== 0; }).join(" ").trim();

    if (!cidade) return res.end("Use ?cidade=NomeDaCidade");

    const municipios = await get("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome");
    const nomeBusca = normaliza(cidade.split(",")[0].trim());
    const ufFiltro = cidade.indexOf(",") !== -1 ? cidade.split(",")[1].trim().toUpperCase() : null;

    let encontrados = municipios.filter(function(m) { return normaliza(m.nome) === nomeBusca; });
    if (encontrados.length === 0) encontrados = municipios.filter(function(m) { return normaliza(m.nome).indexOf(nomeBusca) !== -1; });
    if (encontrados.length === 0) return res.end("Cidade nao encontrada: " + cidade);

    if (ufFiltro) {
      const comUF = encontrados.filter(function(m) { return m.microrregiao.mesorregiao.UF.sigla.toUpperCase() === ufFiltro; });
      if (comUF.length > 0) encontrados = comUF;
    }

    const municipio = encontrados[0];
    const ufSigla = municipio.microrregiao.mesorregiao.UF.sigla;
    const ufNome = municipio.microrregiao.mesorregiao.UF.nome;

    const geo = await get("https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(municipio.nome + ", " + ufNome + ", Brasil") + "&format=json&limit=5&countrycodes=br&addressdetails=1");
    if (!Array.isArray(geo) || geo.length === 0) return res.end("Coordenadas nao encontradas: " + municipio.nome);

    let melhor = geo[0];
    for (let i = 0; i < geo.length; i++) {
      if (geo[i].address && geo[i].address.state && normaliza(geo[i].address.state).indexOf(normaliza(ufNome)) !== -1) {
        melhor = geo[i];
        break;
      }
    }

    const apiKey = "3a9be70b9ba044e3a81150545262206";
    const data = await get("https://api.weatherapi.com/v1/current.json?key=" + apiKey + "&q=" + melhor.lat + "," + melhor.lon + "&lang=pt");

    if (data.error) return res.end("Erro: " + data.error.message);

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
      emoji + " " + municipio.nome + ", " + ufSigla + " | " +
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
