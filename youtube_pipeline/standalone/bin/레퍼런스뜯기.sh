#!/usr/bin/env bash
# 유튜브 영상을 **에이전트가 볼 수 있는 꼴**로 뜯는다 — 맥에서 돌린다.
#
# 왜: 클로드가 도는 컨테이너에서는 유튜브가 봇으로 막힌다("Sign in to confirm").
#     영상 자체는 못 보내도(크다) 프레임 시트 + 자막이면 충분히 읽는다.
#
# 나오는 것 (폴더 하나):
#   시트_01.png …   10초마다 한 프레임, 한 장에 24칸 — 그래픽 문법이 여기 다 보인다
#   자막.txt        유튜브 자동자막 (있으면). 어느 초에 무슨 말을 하는지
#   정보.json       제목·길이·챕터
#
#   brew install yt-dlp ffmpeg
#   bash bin/레퍼런스뜯기.sh "https://www.youtube.com/watch?v=lEfSoR5JCaQ" [초간격=10]
#
# 그 폴더의 시트_*.png 와 자막.txt 를 대화에 올리면 된다.
set -euo pipefail
URL="${1:?유튜브 주소}"; STEP="${2:-10}"
ID=$(echo "$URL" | sed -E 's/.*(v=|youtu\.be\/)([A-Za-z0-9_-]{11}).*/\2/')
OUT="레퍼런스_$ID"; mkdir -p "$OUT"; cd "$OUT"

echo "== 정보·자막 =="
# android 클라이언트가 봇 차단을 제일 잘 넘는다 (web 은 "Sign in to confirm")
YT="yt-dlp --no-warnings --extractor-args youtube:player_client=android"
$YT -J "$URL" > 정보_전체.json
python3 - <<'PY'
import json; d=json.load(open('정보_전체.json'))
json.dump({'title':d.get('title'),'channel':d.get('channel'),'duration':d.get('duration'),
           'chapters':[{'t':c.get('start_time'),'title':c.get('title')} for c in (d.get('chapters') or [])]},
          open('정보.json','w'), ensure_ascii=False, indent=1)
print(d.get('title'), '·', d.get('duration'), '초 · 챕터', len(d.get('chapters') or []))
PY
$YT --skip-download --write-auto-sub --write-sub --sub-lang "ko,en,ja" --sub-format vtt -o "자막" "$URL" >/dev/null 2>&1 || true
for v in 자막*.vtt; do [ -e "$v" ] && python3 - "$v" <<'PY' && break
import re,sys
lines=[]; last=''
for l in open(sys.argv[1],encoding='utf-8'):
    l=l.strip()
    if '-->' in l: t=l.split('-->')[0].strip()[:8]; continue
    if not l or l.isdigit() or l.startswith(('WEBVTT','Kind:','Language:')): continue
    l=re.sub(r'<[^>]+>','',l)
    if l!=last: lines.append(f'{t} {l}'); last=l
open('자막.txt','w',encoding='utf-8').write('\n'.join(lines)); print('자막', len(lines), '줄')
PY
done

echo "== 영상 (720p 면 충분하다) =="
$YT -f "bv*[height<=720]+ba/b[height<=720]" -o "영상.%(ext)s" "$URL" >/dev/null 2>&1 || true
V=$(ls 영상.* 2>/dev/null | head -1)
if [ -z "$V" ]; then
  # 본편이 403 이면 스토리보드(탐색용 160×90 스프라이트)로 — 저해상도지만 구조는 다 보인다
  echo "본편 못 받음 → 스토리보드로 간다"
  $YT -f "sb0/sb1" -o "sb.%(ext)s" "$URL" >/dev/null 2>&1
  python3 - <<'PY2'
import email, io
from email import policy
from PIL import Image, ImageDraw
msg = email.message_from_bytes(open("sb.mhtml","rb").read(), policy=policy.default)
tiles = []
for part in msg.walk():
    if part.get_content_type().startswith("image/"):
        im = Image.open(io.BytesIO(part.get_payload(decode=True))).convert("RGB"); W,H = im.size
        for r in range(H//90):
            for c in range(W//160):
                t = im.crop((c*160, r*90, (c+1)*160, (r+1)*90))
                if sum(t.resize((1,1)).getpixel((0,0))) > 15: tiles.append(t)
import json; dur = json.load(open("정보.json"))["duration"] or 1; step = dur/max(1,len(tiles))
for p in range(0, len(tiles), 48):
    b = tiles[p:p+48]; rows = (len(b)+7)//8
    s = Image.new("RGB", (8*324, rows*200), "#111"); d = ImageDraw.Draw(s)
    for i,t in enumerate(b):
        x,y = (i%8)*324, (i//8)*200; s.paste(t.resize((320,180)), (x+2,y+2)); sec = int((p+i)*step)
        d.text((x+4,y+184), f"{sec//60:02d}:{sec%60:02d}", fill="#EEE")
    s.save(f"시트_{p//48+1:02d}.png")
print("스토리보드 시트", (len(tiles)+47)//48, "장 ·", len(tiles), "프레임")
PY2
  rm -f sb.mhtml 정보_전체.json; echo; echo "→ $(pwd) 의 시트_*.png 와 자막.txt 를 올리면 된다"; exit 0
fi

echo "== 프레임 시트 (${STEP}초 간격) =="
mkdir -p _f && ffmpeg -v error -i "$V" -vf "fps=1/${STEP},scale=480:-1" _f/f%04d.png
python3 - "$STEP" <<'PY'
import glob, sys
from PIL import Image, ImageDraw
step=int(sys.argv[1]); fs=sorted(glob.glob('_f/*.png')); COLS,W,H=6,480,270
for p in range(0,len(fs),24):
    b=fs[p:p+24]; rows=(len(b)+COLS-1)//COLS
    s=Image.new('RGB',(COLS*W,rows*(H+22)),'#111'); d=ImageDraw.Draw(s)
    for i,f in enumerate(b):
        im=Image.open(f).convert('RGB'); im.thumbnail((W-4,H-4))
        x,y=(i%COLS)*W,(i//COLS)*(H+22); s.paste(im,(x+2,y+2))
        sec=(p+i)*step; d.text((x+4,y+H+4),f'{sec//60:02d}:{sec%60:02d}',fill='#EEE')
    s.save(f'시트_{p//24+1:02d}.png')
print('시트', (len(fs)+23)//24, '장 ·', len(fs), '프레임')
PY
rm -rf _f "$V" 정보_전체.json
echo; echo "→ $(pwd)  의 시트_*.png 와 자막.txt 를 올리면 된다"
