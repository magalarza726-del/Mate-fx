#!/usr/bin/env python3
"""Análisis matemático reproducible de CSV/XLSX (herramienta opcional)."""
import argparse
import csv
import json
import math
from pathlib import Path
from statistics import mean


def numeric(text):
    if isinstance(text, (float, int)):
        return float(text)
    text = str(text or '').strip().replace(' ', '')
    if ',' in text and '.' not in text:
        text = text.replace(',', '.')
    return float(text)


def rows_from(path):
    if path.suffix.lower() == '.csv':
        with path.open('r', encoding='utf-8-sig', newline='') as fh:
            sample = fh.read(4096)
            fh.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=',;\t|')
            except csv.Error:
                dialect = csv.excel
            yield from csv.DictReader(fh, dialect=dialect)
    elif path.suffix.lower() == '.xlsx':
        try:
            from openpyxl import load_workbook
        except ImportError as exc:
            raise SystemExit('Instala openpyxl: pip install openpyxl') from exc
        wb = load_workbook(path, read_only=True, data_only=True)
        sheet = wb.active
        it = sheet.values
        headers = [str(h) for h in next(it)]
        for row in it:
            yield dict(zip(headers, row))
    else:
        raise ValueError('Solo CSV/XLSX')


def compute(path, x_name, y_name):
    points = []
    for row in rows_from(path):
        try:
            x, y = numeric(row[x_name]), numeric(row[y_name])
            if math.isfinite(x) and math.isfinite(y):
                points.append((x, y))
        except (ValueError, TypeError, KeyError):
            continue
    if len(points) < 2:
        raise ValueError('Se necesitan al menos dos pares numéricos válidos.')
    xs, ys = zip(*points)
    mx, my = mean(xs), mean(ys)
    sxx = sum((x - mx)**2 for x in xs)
    syy = sum((y - my)**2 for y in ys)
    sxy = sum((x - mx)*(y - my) for x, y in points)
    if sxx == 0 or syy == 0:
        slope = intercept = r = None
    else:
        slope = sxy / sxx
        intercept = my - slope * mx
        r = sxy / math.sqrt(sxx * syy)
    return {'archivo': path.name, 'eje_x': x_name, 'eje_y': y_name,
            'n': len(points), 'media_x': mx, 'media_y': my,
            'pendiente': slope, 'intercepto': intercept,
            'correlacion_Pearson': r, 'R_cuadrado': None if r is None else r*r}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archivo', type=Path)
    parser.add_argument('--x', required=True, help='Nombre exacto de columna X')
    parser.add_argument('--y', required=True, help='Nombre exacto de columna Y')
    args = parser.parse_args()
    print(json.dumps(compute(args.archivo, args.x, args.y), indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
