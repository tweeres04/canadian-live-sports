import { Button } from "~/components/ui/button";
import { useRevalidator, Await } from "react-router";
import type { Route } from "./+types/home";
import { Suspense } from "react";

function Skeleton() {
  return (
    <ul className="space-y-8 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i}>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="flex gap-5">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function meta({}: Route.MetaArgs) {
  return [
    {
      title:
        "What's on right now on Canadian sports networks? - Canadian Live Sports",
    },
    {
      name: "description",
      content:
        "Want to watch sports but not sure what's on? Find out what's on right now on TSN, Sportsnet, and OneSoccer. Fast, and all in one place.",
    },
  ];
}

function RefreshIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function isLive({
  startTime,
  endTime,
}: {
  startTime: string;
  endTime: string;
}) {
  return new Date(endTime) >= new Date() && new Date(startTime) <= new Date();
}

function mergeDuplicates(events: Event[]) {
  return events
    .filter(
      (event, index) =>
        events.findIndex(
          (e) =>
            e.name === event.name &&
            e.startTime === event.startTime &&
            e.endTime === event.endTime,
        ) === index,
    )
    .map((event) => ({
      ...event,
      channel: events
        .filter(
          (e) =>
            e.name === event.name &&
            e.startTime === event.startTime &&
            e.endTime === event.endTime,
        )
        .map((e) => e.channel)
        .toSorted((a, b) => {
          // this logic is duplicated below. Would be good to consolidate it
          const aIsLowPriority =
            a.startsWith("SN NOW+") || a.startsWith("TSN+");
          const bIsLowPriority =
            b.startsWith("SN NOW+") || b.startsWith("TSN+");

          return aIsLowPriority && !bIsLowPriority
            ? 1
            : !aIsLowPriority && bIsLowPriority
              ? -1
              : a.localeCompare(b);
        })
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

function oneSoccerEventToEvent(oneSoccerEvent) {
  return {
    name: oneSoccerEvent.title,
    duration: oneSoccerEvent.duration,
    startTime: oneSoccerEvent.eventStartDate,
    endTime: oneSoccerEvent.eventEndDate,
    channel: "OneSoccer",
  };
}

async function getTsnEvents() {
  const response = await fetch(
    "https://www.tsn.ca/pf/api/v3/content/fetch/sports-schedule-custom",
  );
  if (!response.ok) {
    const text = await response.text();
    throw `${response.status}: ${text}`;
  }
  const tsnSchedule = await response.json();
  console.log(`TSN items: ${JSON.stringify(tsnSchedule, null, 2)}`);
  const liveItems: Event[] = tsnSchedule.map(tsnEventToEvent);
  return liveItems;
}

async function getSportsnetEvents() {
  const now = new Date();
  const startDate = Math.floor(now.getTime() / 1000 - 60 * 60 * 8);
  const endDate = startDate + 60 * 60 * 16;

  const url = new URL("https://schedule-admin.sportsnet.ca/v1/events");
  url.searchParams.set("day_start", startDate.toString());
  url.searchParams.set("day_end", endDate.toString());

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw `${response.status}: ${text}`;
  }
  let events = await response.json();
  events = events.data.map(sportsnetEventToEvent);

  return events;
}

async function getOneSoccerEvents() {
  const url = new URL("https://prod-cdn.volt-axis-onesoccer.com/api/page");
  url.searchParams.set("path", "/");

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw `${response.status}: ${text}`;
  }
  const data = await response.json();
  const events = data.entries[1].list.items.map(oneSoccerEventToEvent);

  return events;
}

const errorHandler = (errors: string[], channel: string) => (err: Error) => {
  console.error(err);
  errors.push(`${channel} error: ${err.toString()}`);
};

export function loader({ params }: Route.LoaderArgs) {
  const errors: string[] = [];
  const eventsPromise = Promise.all([
    getSportsnetEvents().catch(errorHandler(errors, "Sportsnet")),
    getTsnEvents().catch(errorHandler(errors, "TSN")),
    getOneSoccerEvents().catch(errorHandler(errors, "OneSoccer")),
  ]).then((results) => {
    const events = results.flat().filter(Boolean);

    const liveEvents = events.filter(isLive);

    const mergedEvents = mergeDuplicates(liveEvents);

    const sortedEvents = mergedEvents.toSorted((a, b) => {
      // this logic is duplicated above. Would be good to consolidate it
      const aIsLowPriority =
        a.channel.startsWith("SN NOW+") || a.channel.startsWith("TSN+");
      const bIsLowPriority =
        b.channel.startsWith("SN NOW+") || b.channel.startsWith("TSN+");

      return aIsLowPriority && !bIsLowPriority
        ? 1
        : !aIsLowPriority && bIsLowPriority
          ? -1
          : a.channel.localeCompare(b.channel);
    });

    return { events: sortedEvents, errors };
  });

  return { eventsData: eventsPromise };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { eventsData } = loaderData;
  const { revalidate, state: revalidatorState } = useRevalidator();

  return (
    <div className="md:max-w-[900px] mx-auto space-y-5 px-1">
      <h1 className="text-4xl">Canadian live sports</h1>
      <div className="flex justify-end">
        <Button
          onClick={revalidate}
          disabled={revalidatorState === "loading"}
          variant="secondary"
        >
          <RefreshIcon />
          {revalidatorState === "loading" ? "Refreshing..." : "Refresh"}{" "}
        </Button>
      </div>
      <Suspense fallback={<Skeleton />}>
        <Await resolve={eventsData}>
          {({ events, errors }) => (
            <>
              {errors.length > 0 ? (
                <div className="px-2 py-5 bg-red-50 rounded">
                  {errors.map((e) => (
                    <p key={e} className="text-red-950">
                      {e}
                    </p>
                  ))}
                </div>
              ) : null}
              <ul className="space-y-8">
                {events.map((event) => (
                  <li key={`${event.name}${event.startTime}`}>
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
              </ul>
            </>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
