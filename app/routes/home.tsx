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

type Event = ReturnType<typeof tsnEventToEvent>;

function tsnEventToEvent(tsnItem) {
  return {
    name: tsnItem.headlines.basic,
    duration: tsnItem.duration,
    startTime: tsnItem.startTime,
    endTime: tsnItem.endTime,
    channel: tsnItem.channelName,
  };
}

function sportsnetEventToEvent(sportsnetEvent) {
  return {
    name: sportsnetEvent.event_name,
    duration: sportsnetEvent.event_duration,
    startTime: new Date(sportsnetEvent.start_time_utc * 1000).toISOString(),
    endTime: new Date(sportsnetEvent.end_time_utc * 1000).toISOString(),
    channel: [
      sportsnetEvent.primary_broadcaster,
      sportsnetEvent.secondary_broadcaster,
      sportsnetEvent.tertiary_broadcaster,
    ]
      .filter(Boolean)
      .join(", "),
  };
}

async function getTsnEvents() {
  const tsnSchedule = await fetch(
    "https://www.tsn.ca/pf/api/v3/content/fetch/sports-schedule-custom"
  ).then((data) => data.json());
  const liveItems: Event[] = tsnSchedule.filter(isLive).map(tsnEventToEvent);
  return liveItems;
}

async function getSportsnetEvents() {
  const today = new Date();
  const startDate = Math.floor(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() /
      1000
  );
  const endDate = Math.floor(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    ).getTime() / 1000
  );

  const url = new URL("https://schedule-admin.sportsnet.ca/v1/events");
  url.searchParams.set("day_start", startDate.toString());
  url.searchParams.set("day_end", endDate.toString());

  const events = await fetch(url).then((response) => response.json());

  return events.data.map(sportsnetEventToEvent).filter(isLive);
}

export async function loader({ params }: Route.LoaderArgs) {
  const events = (
    await Promise.all([getSportsnetEvents(), getTsnEvents()])
  ).flat();

  const sortedEvents = events.toSorted(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return sortedEvents;
}

export default function Home({ loaderData: events }: Route.ComponentProps) {
  return (
    <div className="md:max-w-[900px] mx-auto space-y-5 px-1">
      <h1 className="text-4xl">Canadian live sports</h1>
      <ul className="space-y-8">
        {events.map((event) => (
          <li>
            <h2 className="text-2xl">{event.name}</h2>
            <div className="flex gap-5">
              <div>{event.channel}</div>
              <div>
                {new Intl.DateTimeFormat("en-CA", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }).format(new Date(event.startTime))}{" "}
                -{" "}
                {new Intl.DateTimeFormat("en-CA", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }).format(new Date(event.endTime))}
              </div>
            </div>
          </li>
        ))}
        {/* {events.map((event) => (
          <pre>{JSON.stringify(event, null, 4)}</pre>
        ))} */}
      </ul>
    </div>
  );
}
