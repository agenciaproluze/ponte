// Monta o código "Pix copia e cola" (BR Code / EMV) com valor e identificador (txid).
// Segue o padrão do Banco Central para QR Code estático com valor.
function campo(id, valor) {
  const v = String(valor);
  return id + String(v.length).padStart(2, "0") + v;
}

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido pelo padrão Pix
function crc16(texto) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Remove acentos e caracteres fora do padrão (nomes e cidade)
function ascii(t, max) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 .-]/g, "").toUpperCase().slice(0, max);
}

// CPF, CNPJ e telefone como chave são enviados só com números
function chaveNormalizada(chave) {
  const c = String(chave || "").trim();
  return /^[\d.\/\-\s()+]+$/.test(c) && !c.startsWith("+") ? c.replace(/\D/g, "") : c;
}

export function pixCopiaCola({ chave, valor, txid, nome, cidade }) {
  const valorTxt = Number(valor).toFixed(2);
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chaveNormalizada(chave));
  const semCrc =
    campo("00", "01") +
    campo("01", "11") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", valorTxt) +
    campo("58", "BR") +
    campo("59", ascii(nome, 25) || "TEK4LL") +
    campo("60", ascii(cidade, 15) || "RIO DE JANEIRO") +
    campo("62", campo("05", String(txid).replace(/[^A-Za-z0-9]/g, "").slice(0, 25))) +
    "6304";
  return semCrc + crc16(semCrc);
}
