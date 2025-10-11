import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Canadian Live Sports" },
    { name: "description", content: "Find out what's on, quickly" },
  ];
}

function isLive({
  startTime,
  endTime,
}: {
  startTime: string;
  endTime: string;
}) {
  return new Date(endTime) > new Date() && new Date(startTime) < new Date();
}

type ScheduleItem = ReturnType<typeof tsnItemToScheduleItem>;

function tsnItemToScheduleItem(tsnItem) {
  return {
    name: tsnItem.headlines.basic,
    duration: tsnItem.duration,
    startTime: tsnItem.startTime,
    endTime: tsnItem.endTime,
    channel: tsnItem.channelName,
  };
}

export async function loader({ params }: Route.LoaderArgs) {
  const tsnSchedule = await fetch(
    "https://www.tsn.ca/pf/api/v3/content/fetch/sports-schedule-custom"
  ).then((data) => data.json());
  const liveItems: ScheduleItem[] = tsnSchedule
    .filter(isLive)
    .map(tsnItemToScheduleItem)
    .toSorted(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  return liveItems;
}

export default function Home({
  loaderData: tsnSchedule,
}: Route.ComponentProps) {
  return (
    <div className="md:max-w-[900px] mx-auto space-y-5">
      <h1 className="text-2xl">Canadian live sports</h1>
      <ul className="space-y-3">
        {tsnSchedule.map((scheduleItem) => (
          <li>
            <h2 className="text-xl">{scheduleItem.name}</h2>
            <div className="flex">
              {scheduleItem.channel} -{" "}
              {new Intl.DateTimeFormat("en-CA", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }).format(new Date(scheduleItem.startTime))}{" "}
              -{" "}
              {new Intl.DateTimeFormat("en-CA", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }).format(new Date(scheduleItem.endTime))}
            </div>
          </li>
        ))}
        {/* {tsnSchedule.map((scheduleItem) => (
          <pre>{JSON.stringify(scheduleItem, null, 4)}</pre>
        ))} */}
      </ul>
    </div>
  );
}
