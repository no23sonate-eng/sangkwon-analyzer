#!/bin/bash
cd /home/user/sangkwon-analyzer
# **렌더는 한 번에 하나만.** 앞 렌더가 도는데 새로 시작하면 clips 를 지우고
# 들어가서 앞 렌더의 QA 가 85컷 없음으로 깨지고 미리보기가 51프레임짜리로
# 나온다 (실제로 그렇게 됐다). 잠금을 못 잡으면 그냥 죽는다.
exec 9>/tmp/parkside_render.lock
flock -n 9 || { echo '다른 렌더가 이미 돌고 있다 — 중단'; exit 1; }
S=/tmp/claude-0/-home-user-sangkwon-analyzer/5ab6e313-332c-5aa7-a8b8-bd8d00e79058/scratchpad
FF=/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2
python3 youtube_pipeline/scripts/dedupe_assets.py 올리브영성수 --apply
python3 youtube_pipeline/scripts/render_parkside.py --project 올리브영성수 > $S/c3.log 2>&1
echo "카드 $(grep -c '^\[ok\]' $S/c3.log)"
python3 youtube_pipeline/scripts/render_broll.py --project 올리브영성수 > $S/b3.log 2>&1
echo "실사 $(grep -c '^\[ok\]' $S/b3.log)"
python3 youtube_pipeline/scripts/qa_check.py 올리브영성수 > $S/q3.log 2>&1
grep -E "^(✗|!)" $S/q3.log | head -5; tail -2 $S/q3.log
python3 youtube_pipeline/scripts/make_preview.py 올리브영성수 --crf 26 > $S/p3.log 2>&1
cd youtube_pipeline/projects/올리브영성수
$FF -y -loglevel error -i 올리브영성수_미리보기.mp4 -vf scale=1280:720 -c:v libx264 \
  -preset veryfast -crf 31 -maxrate 380k -bufsize 900k -pix_fmt yuv420p -an 미리보기_저용량.mp4
ls -la 미리보기_저용량.mp4 | awk '{printf "미리보기 %.1f MB\n",$5/1048576}'
rm -rf $S/big2; mkdir -p $S/big2
for f in clips/*.mp4; do
  b=$(basename "$f" .mp4)
  d=$($FF -i "$f" 2>&1 | grep -oP 'Duration: \d+:\d+:\K[\d.]+' | head -1)
  t=$(python3 -c "print(max(0.1,float('${d:-2}')*0.75))")
  $FF -y -loglevel error -ss $t -i "$f" -frames:v 1 -vf scale=600:-1 -q:v 6 "$S/big2/$b.jpg" 2>/dev/null
done
echo "프레임 $(ls $S/big2/*.jpg | wc -l)"
