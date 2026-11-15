import os, re, json, sys
from datetime import datetime
import requests
from playwright.sync_api import sync_playwright

CAIXA_URL = "https://loterias.caixa.gov.br/Paginas/Federal.aspx"

def parse_result(text):
    # O site é renderizado por JavaScript. Procuramos a área de resultado, não
    # os números ilustrativos da seção "Como jogar".
    heading = re.search(r"Resultado\s+Concurso\s+(\d+)\s*\(([^)]+)\)", text, re.I)
    if not heading:
        raise ValueError("Não foi possível localizar o cabeçalho do resultado renderizado.")
    numero = int(heading.group(1))
    raw_date = heading.group(2).strip()
    date_match = re.search(r"(\d{2})/(\d{2})/(\d{4})", raw_date)
    if date_match:
        data = f"{date_match.group(3)}-{date_match.group(2)}-{date_match.group(1)}"
    else:
        raise ValueError(f"Data do concurso não reconhecida: {raw_date}")

    # Delimita o conteúdo até a seção explicativa, evitando números de exemplo.
    start = heading.end()
    end_match = re.search(r"\n\s*Como jogar", text[start:], re.I)
    section = text[start:start + end_match.start()] if end_match else text[start:start+5000]

    # Captura bilhetes em linhas de prêmios ordenados. O parser exige exatamente
    # cinco bilhetes distintos/posicionados; qualquer mudança do site interrompe.
    patterns = [
        r"([1-5])\s*[º°]\s*(?:Sorteio)?\s*[\r\n\t ]+(\d{5})",
        r"([1-5])\s*[º°][^\d]{0,80}(\d{5})"
    ]
    found = {}
    for pattern in patterns:
        for pos, ticket in re.findall(pattern, section, re.I):
            found[int(pos)] = ticket
        if len(found) == 5:
            break
    if len(found) != 5:
        raise ValueError(
            f"Parser não reconheceu os cinco prêmios do concurso {numero}. "
            f"Encontrados: {len(found)}. Nenhum dado foi enviado."
        )
    return {
        "numero": numero,
        "data_concurso": data,
        "fonte": "CAIXA - página oficial renderizada",
        "fonte_url": CAIXA_URL,
        "premios": [{"posicao": i, "bilhete": found[i]} for i in range(1,6)]
    }

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(locale="pt-BR")
        page.goto(CAIXA_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(12000)
        text = page.locator("body").inner_text(timeout=20000)
        browser.close()

    result = parse_result(text)
    print(json.dumps(result, ensure_ascii=False))
    base = os.environ["SUPABASE_URL"].rstrip("/")
    secret = os.environ["COLLECTOR_SECRET"]
    response = requests.post(
        base + "/functions/v1/ingest-resultados",
        headers={"Content-Type":"application/json","x-collector-secret":secret},
        json=result, timeout=40
    )
    response.raise_for_status()
    print(response.text)

if __name__ == "__main__":
    main()
