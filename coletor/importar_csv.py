import csv, os, sys, requests
from datetime import datetime

def main(path):
    base = os.environ["SUPABASE_URL"].rstrip("/")
    secret = os.environ["COLLECTOR_SECRET"]
    payload = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        required = {"concurso","data","primeiro","segundo","terceiro","quarto","quinto"}
        if not required.issubset(set(reader.fieldnames or [])):
            raise SystemExit("CSV precisa ter: concurso,data,primeiro,segundo,terceiro,quarto,quinto")
        for row in reader:
            date = row["data"].strip()
            datetime.strptime(date, "%Y-%m-%d")
            nums = [row[k].strip().zfill(5) for k in ("primeiro","segundo","terceiro","quarto","quinto")]
            if any(len(n)!=5 or not n.isdigit() for n in nums):
                raise ValueError(f"Bilhete inválido no concurso {row['concurso']}")
            payload.append({
                "numero":int(row["concurso"]), "data_concurso":date,
                "fonte":"Importação CSV conferida",
                "premios":[{"posicao":i+1,"bilhete":n} for i,n in enumerate(nums)]
            })
    for offset in range(0,len(payload),100):
        r = requests.post(base+"/functions/v1/ingest-resultados",
            headers={"Content-Type":"application/json","x-collector-secret":secret},
            json=payload[offset:offset+100], timeout=60)
        r.raise_for_status()
        print(r.text)
    print(f"Importação concluída: {len(payload)} concursos enviados.")

if __name__ == "__main__":
    if len(sys.argv)!=2: raise SystemExit("Uso: python importar_csv.py historico.csv")
    main(sys.argv[1])
