from pathlib import Path

p = Path('src/index.css')
text = p.read_text()
# Algumas regras manuais foram gravadas com duas barras invertidas. Em CSS,
# classes Tailwind com ':' '/' e '.' precisam de apenas uma barra de escape.
text = text.replace(r'\\', r'\')
p.write_text(text)
