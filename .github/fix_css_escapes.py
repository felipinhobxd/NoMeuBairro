from pathlib import Path

p = Path('src/index.css')
text = p.read_text()
# Algumas regras manuais foram gravadas com duas barras invertidas. Em CSS,
# classes Tailwind com ':' '/' e '.' precisam de apenas uma barra de escape.
slash = chr(92)
text = text.replace(slash * 2, slash)
p.write_text(text)
