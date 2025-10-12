import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Canadian Live Sports" },
    {
      name: "description",
      content: "Find out what's on right now on TSN and Sportsnet, quickly",
    },
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

function mergeDuplicates(events: Event[]) {
  return events
    .filter(
      (event, index) =>
        events.findIndex(
          (e) =>
            e.name === event.name &&
            e.startTime === event.startTime &&
            e.endTime === event.endTime
        ) === index
    )
    .map((event) => ({
      ...event,
      channel: events
        .filter(
          (e) =>
            e.name === event.name &&
            e.startTime === event.startTime &&
            e.endTime === event.endTime
        )
        .map((e) => e.channel)
        .toSorted((a, b) => a.localeCompare(b))
        .join(", "),
    }));
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
  const now = new Date();
  const startDate = Math.floor(now.getTime() / 1000 - 60 * 60 * 8);
  const endDate = startDate + 60 * 60 * 16;

  const url = new URL("https://schedule-admin.sportsnet.ca/v1/events");
  url.searchParams.set("day_start", startDate.toString());
  url.searchParams.set("day_end", endDate.toString());

  let events = await fetch(url).then((response) => response.json());
  events = events.data.map(sportsnetEventToEvent);
  events = events.filter(isLive);

  return events;
}

export async function loader({ params }: Route.LoaderArgs) {
  const events = (
    await Promise.all([getSportsnetEvents(), getTsnEvents()])
  ).flat();

  const mergedEvents = mergeDuplicates(events);

  const sortedEvents = mergedEvents.toSorted((a, b) => {
    const aIsPriority =
      a.channel.startsWith("SN NOW+") || a.channel.startsWith("TSN+");
    const bIsPriority =
      b.channel.startsWith("SN NOW+") || b.channel.startsWith("TSN+");

    return aIsPriority && !bIsPriority
      ? 1
      : !aIsPriority && bIsPriority
        ? -1
        : a.channel.localeCompare(b.channel);
  });

  return sortedEvents;
}

export default function Home({ loaderData: events }: Route.ComponentProps) {
  return (
    <div className="md:max-w-[900px] mx-auto space-y-5 px-1">
      <h1 className="text-4xl">Canadian live sports</h1>
      <ul className="space-y-8">
        {events.map((event) => (
          <li key={event.name}>
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
