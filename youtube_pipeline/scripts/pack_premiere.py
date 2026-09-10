#!/usr/bin/env python3
"""프리미어에 바로 올릴 꾸러미를 만든다 — **맥에서 열 것**을 전제로.

왜 이름을 바꾸나
  우리 파일명은 한글이다(`니시아자부_타임라인.xml`). 맥은 파일명을 NFD 로
  풀어 쓰고 리눅스/윈도는 NFC 로 붙여 쓴다. 리눅스에서 그냥 zip 하면 맥에서
  자소가 분리돼 보이거나(ㄴㅣㅅㅣ…) 깨진다. 꾸러미 안에서는 **전부 ASCII** 로
  바꾼다 — 프리미어가 읽을 이름이지 사람이 읽을 이름이 아니다.

  클립 이름(`sec12_cut13.mp4`)은 이미 ASCII 라 그대로 둔다. XML 안의
  pathurl 이 그 이름을 가리키므로 건드리면 안 된다.

무엇이 들어가나
  clips/          컷 mp4 (순서대로)
  timeline.xml    FCP7 XML — 프리미어 File ▸ Import
  README.txt      여는 법. 미디어를 못 찾는다고 하면 clips 폴더를 지정한다

    python3 scripts/pack_premiere.py 니시아자부
    python3 scripts/pack_premiere.py 니시아자부 --split 4   # 4조각으로 나눈다
"""
import argparse
import pathlib
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

README = """파크웰스테이트 니시아자부 — 프리미어 꾸러미

조각이 여러 개면 **맥에서 더블클릭하지 말 것.** 맥 Archive Utility 는
압축을 합쳐 주지 않는다 — 같은 이름이 있으면 `clips 2`, `clips 3` 으로
따로 만든다. 조각 스무 개면 폴더가 스무 개 생긴다.

터미널에서 (조각들이 있는 폴더에서):

    for z in *_premiere_*.zip; do unzip -o -q "$z" -d nishiazabu; done

그러면 `nishiazabu/clips/` 하나에 다 모인다.

1. 프리미어에서 File > Import 로 nishiazabu/timeline.xml 을 연다.
2. 미디어를 찾을 수 없다고 물으면 clips 폴더를 지정한다. 한 번만 지정하면
   나머지는 알아서 붙는다 — XML 은 폴더 없이 파일 이름만 갖고 있어서
   클립을 어디에 두든 상관없다.

터미널을 안 쓰겠다면: 스무 개를 다 더블클릭해 폴더 스무 개를 만든 뒤,
프리미어의 미디어 찾기에서 **그 폴더들을 담고 있는 상위 폴더**를 지정한다.
프리미어는 하위 폴더까지 뒤진다.

컷 이름은 sec(컷번호)_cut(순번).mp4 다. 시퀀스의 클립 이름 앞에도 #컷번호가
붙어 있어 검수 시트의 번호와 그대로 대응된다.

전부 1920x1080 / 30fps / H.264 다. 오디오는 없다 — 나레이션과 자막은
프리미어에서 얹는다.
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--split', type=int, default=1,
                    help='이 개수로 나눠 담는다 (큰 파일을 못 보낼 때)')
    # **개수로 나누면 안 된다.** 컷 하나가 200KB 인 것도 6.5MB 인 것도 있어서
    # 68컷씩 넷으로 잘랐더니 156MB / 111MB / 121MB / 111MB 로 들쭉날쭉했다.
    # 보내는 쪽에 한도가 있으면 **크기로** 잘라야 한다
    ap.add_argument('--max-mb', type=float, default=0,
                    help='한 조각이 이 크기를 넘지 않게 자른다 (0이면 --split 을 쓴다)')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    clips = sorted((pdir / 'clips').glob('*.mp4'),
                   key=lambda f: int(re.match(r'sec(\d+)', f.name).group(1)))
    xml = next(pdir.glob('*타임라인*.xml'), None)
    if not clips:
        sys.exit('clips 가 없다 — 먼저 렌더해야 한다')
    if not xml:
        sys.exit('타임라인 XML 이 없다 — build_premiere_xml.py 를 먼저 돌려라')

    total = sum(f.stat().st_size for f in clips)
    print(f'컷 {len(clips)}개 · {total / 1024 / 1024:.0f}MB')

    out = ROOT / 'projects' / a.project / 'premiere_package'
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    if a.max_mb:
        # XML·README 가 들어가는 첫 조각은 그만큼 여유를 둔다
        cap = a.max_mb * 1024 * 1024
        batches, cur, size = [], [], xml.stat().st_size + 4096
        for f in clips:
            s = f.stat().st_size
            if cur and size + s > cap:
                batches.append(cur); cur, size = [], 0
            cur.append(f); size += s
        if cur:
            batches.append(cur)
    else:
        n = max(1, a.split)
        per = (len(clips) + n - 1) // n
        batches = [clips[i * per:(i + 1) * per] for i in range(n)]
        batches = [b for b in batches if b]

    n = len(batches)
    made = []
    for i, batch in enumerate(batches):
        name = f'{a.project}_premiere' if n == 1 else f'{a.project}_premiere_{i + 1:02d}of{n}'
        name = re.sub(r'[^\x00-\x7F]+', 'nishiazabu', name)
        z = out / f'{name}.zip'
        # mp4 는 이미 압축돼 있다 — 다시 줄이려 들면 시간만 쓰고 안 준다
        with zipfile.ZipFile(z, 'w', zipfile.ZIP_STORED, allowZip64=True) as zf:
            for f in batch:
                zf.write(f, f'clips/{f.name}')
            if i == 0:
                zf.write(xml, 'timeline.xml')
                zf.writestr('README.txt', README)
        mb = z.stat().st_size / 1024 / 1024
        made.append((z, mb, len(batch)))
        print(f'  {z.name}  {mb:.0f}MB  ({len(batch)}컷)')
    print(f'\n{out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
