const fallbackSamples = [
  {
    youtubeId: "BDc0DlKaXEI",
    title: "Call to Adventure — Kevin MacLeod",
    channel: "Audio Library",
    thumbnail: "https://i.ytimg.com/vi/BDc0DlKaXEI/hqdefault.jpg",
  },
  {
    youtubeId: "6dl55XXsU-M",
    title: "Danse Macabre — Kevin MacLeod",
    channel: "Audio Library",
    thumbnail: "https://i.ytimg.com/vi/6dl55XXsU-M/hqdefault.jpg",
  },
];

const queries = [
  "soul instrumental",
  "jazz instrumental",
  "vintage funk instrumental",
  "ambient instrumental",
  "piano instrumental",
  "psychedelic instrumental",
  "world music instrumental",
  "cinematic instrumental",
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export async function pickYouTubeSample() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return randomItem(fallbackSamples);

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "50",
    videoCategoryId: "10",
    videoEmbeddable: "true",
    videoLicense: "creativeCommon",
    videoDuration: "short",
    safeSearch: "strict",
    q: randomItem(queries),
    key: apiKey,
  });

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!response.ok) throw new Error(`YouTube API: ${response.status}`);
    const data = await response.json();
    const videos = data.items?.filter((item) => item.id?.videoId) ?? [];
    const selected = randomItem(videos);
    if (!selected) return randomItem(fallbackSamples);
    return {
      youtubeId: selected.id.videoId,
      title: selected.snippet.title,
      channel: selected.snippet.channelTitle,
      thumbnail: selected.snippet.thumbnails?.high?.url ?? selected.snippet.thumbnails?.default?.url,
    };
  } catch (error) {
    console.error("YouTube sample fallback:", error.message);
    return randomItem(fallbackSamples);
  }
}
