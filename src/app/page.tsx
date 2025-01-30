"use client";

import {
  Grid2 as Grid,
  Typography,
  Card,
  Box,
  Container,
  CircularProgress,
  useTheme,
} from "@mui/material";
import { DateRange } from "@mui/x-date-pickers-pro";
import { DateRangePicker } from "@mui/x-date-pickers-pro/DateRangePicker";
import { SingleInputDateRangeField } from "@mui/x-date-pickers-pro/SingleInputDateRangeField";
import { Controller, useForm } from "react-hook-form";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  VariableSizeList,
  ListChildComponentProps,
  areEqual,
  FixedSizeGrid,
  GridChildComponentProps,
  VariableSizeGrid,
  GridOnScrollProps,
} from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { styled } from "@mui/material/styles";
import dayjs from "dayjs";
import { countDaysByMonth } from "@/utils";
import Navbar from "@/components/Navbar";
import useRoomRateAvailabilityCalendar from "./(hooks)/useRoomRateAvailabilityCalendar";
import { useInView } from "react-intersection-observer";
import RoomRateAvailabilityCalendar from "./(components)/RoomCalendar";

// Types
type CalendarForm = {
  date_range: DateRange<dayjs.Dayjs>;
};

const StyledVariableSizeList = styled(VariableSizeList)({
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  "&::-webkit-scrollbar": { display: "none" },
});

// Main Component
export default function RateCalendarPage() {
  const theme = useTheme();
  const { ref: loadMoreRef, inView } = useInView();
  const propertyId = 1;

  // Refs
  const rootContainerRef = useRef<HTMLDivElement>(null);
  const calenderMonthsRef = useRef<VariableSizeList>(null);
  const calenderDatesRef = useRef<FixedSizeGrid>(null);
  const mainGridContainerRef = useRef<HTMLDivElement>(null);
  const InventoryRefs = useRef<Array<React.RefObject<VariableSizeGrid>>>([]);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Form Handling
  const { control, watch } = useForm<CalendarForm>({
    defaultValues: { date_range: [dayjs(), dayjs().add(4, "month")] },
  });
  const watchedDateRange = watch("date_range");

  // Date Calculations
  const { dates: calenderDates, months: calenderMonths } = useMemo(() => {
    const start = watchedDateRange[0] || dayjs();
    const end = watchedDateRange[1] || start.add(2, "month");
    return countDaysByMonth(start, end);
  }, [watchedDateRange]);

  // Data Fetching
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRoomRateAvailabilityCalendar({
    property_id: propertyId,
    start_date:
      watchedDateRange[0]?.format("YYYY-MM-DD") || dayjs().format("YYYY-MM-DD"),
    end_date:
      (watchedDateRange[1] || watchedDateRange[0]?.add(2, "month"))?.format(
        "YYYY-MM-DD"
      ) || dayjs().add(2, "month").format("YYYY-MM-DD"),
  });

  // Update the syncScroll function to handle both directions
  const syncScroll = useCallback(
    ({
      scrollLeft,
      scrollTop,
    }: {
      scrollLeft?: number;
      scrollTop?: number;
    }) => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        if (scrollLeft !== undefined) {
          InventoryRefs.current.forEach((ref) =>
            ref.current?.scrollTo({ scrollLeft })
          );
          calenderMonthsRef.current?.scrollTo(scrollLeft);
          calenderDatesRef.current?.scrollTo({ scrollLeft });
        }
        if (scrollTop !== undefined) {
          InventoryRefs.current.forEach((ref) =>
            ref.current?.scrollTo({ scrollTop })
          );
        }
      }, 16);
    },
    []
  );

  const handleScroll = useCallback(
    ({ scrollLeft, scrollTop }: GridOnScrollProps) => {
      syncScroll({ scrollLeft, scrollTop });
    },
    [syncScroll]
  );

  // Update touch handling to support vertical scrolling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!mainGridContainerRef.current) return;

      const deltaX = touchStartX.current - e.touches[0].clientX;
      const deltaY = touchStartY.current - e.touches[0].clientY;

      const newScrollLeft =
        mainGridContainerRef.current.scrollLeft + deltaX * 2;
      const newScrollTop = mainGridContainerRef.current.scrollTop + deltaY * 2;

      mainGridContainerRef.current.scrollLeft = newScrollLeft;
      mainGridContainerRef.current.scrollTop = newScrollTop;

      syncScroll({ scrollLeft: newScrollLeft, scrollTop: newScrollTop });

      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    },
    [syncScroll]
  );

  // Infinite Scroll
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Memoized Components
  const MonthRow = memo(
    ({ index, style }: ListChildComponentProps) => (
      <Box style={style}>
        <Box
          sx={{
            px: 1,
            fontSize: "12px",
            fontWeight: "bold",
            borderLeft: "1px solid",
            borderBottom: "1px solid",
            borderColor: theme.palette.divider,
          }}>
          <Box component="span" sx={{ position: "sticky", left: 2, zIndex: 1 }}>
            {calenderMonths[index]?.[0]}
          </Box>
        </Box>
      </Box>
    ),
    areEqual
  );
  MonthRow.displayName = "MonthRow";

  const DateRow = memo(
    ({ columnIndex, style }: GridChildComponentProps) => (
      <Box style={style}>
        <Box
          sx={{
            pr: 1,
            fontSize: "12px",
            textAlign: "right",
            fontWeight: "bold",
            borderLeft: "1px solid",
            borderBottom: "1px solid",
            borderColor: theme.palette.divider,
          }}>
          <Box>{calenderDates[columnIndex]?.format("ddd")}</Box>
          <Box>{calenderDates[columnIndex]?.format("DD")}</Box>
        </Box>
      </Box>
    ),
    areEqual
  );
  DateRow.displayName = "DateRow";

  const PageRoomList = memo(
    ({
      rooms,
      InventoryRefs,
      handleCalenderScroll,
    }: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rooms: any[];
      InventoryRefs: React.MutableRefObject<
        Array<React.RefObject<VariableSizeGrid>>
      >;
      handleCalenderScroll: ({ scrollLeft }: GridOnScrollProps) => void;
    }) => {
      return (
        <>
          {rooms.map((room, index) => (
            <RoomRateAvailabilityCalendar
              key={room.id}
              index={index}
              room_category={room}
              InventoryRefs={InventoryRefs}
              handleCalenderScroll={handleCalenderScroll}
              isLastElement={index === rooms.length - 1}
            />
          ))}
        </>
      );
    },
    (prev, next) =>
      prev.rooms.length === next.rooms.length &&
      prev.rooms.every((r, i) => r.id === next.rooms[i]?.id)
  );
  PageRoomList.displayName = "PageRoomList";
  return (
    <Container sx={{ backgroundColor: "#EEF2F6" }}>
      <Navbar />
      <Box>
        <Card elevation={1} sx={{ padding: 4, mt: 4 }}>
          <Grid container columnSpacing={2}>
            <Grid size={12}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
                Rate Calendar
              </Typography>
            </Grid>
            <Grid size={4}>
              <Controller
                name="date_range"
                control={control}
                rules={{ required: "Please specify a date range." }}
                render={({ field, fieldState: { invalid, error } }) => (
                  <DateRangePicker
                    {...field}
                    minDate={dayjs()}
                    maxDate={dayjs().add(2, "year")}
                    slots={{ field: SingleInputDateRangeField }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: invalid,
                        helperText: invalid ? error?.message : null,
                      },
                    }}
                  />
                )}
              />
            </Grid>
          </Grid>
        </Card>

        <Card
          elevation={1}
          sx={{ my: 6, padding: 3 }}
          ref={rootContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}>
          <Grid container columnSpacing={2}>
            <Grid size={{ xs: 4, sm: 4, md: 3, lg: 2, xl: 2 }} />
            <Grid size={{ xs: 8, sm: 8, md: 9, lg: 10, xl: 10 }}>
              <AutoSizer disableHeight>
                {({ width }) => (
                  <StyledVariableSizeList
                    height={19}
                    width={width}
                    itemCount={calenderMonths.length}
                    itemSize={(index) => calenderMonths[index][1] * 74}
                    layout="horizontal"
                    ref={calenderMonthsRef}>
                    {MonthRow}
                  </StyledVariableSizeList>
                )}
              </AutoSizer>
            </Grid>
          </Grid>

          <Grid container sx={{ height: 48 }}>
            <Grid size={{ xs: 4, sm: 4, md: 3, lg: 2, xl: 2 }} />
            <Grid size={{ xs: 8, sm: 8, md: 9, lg: 10, xl: 10 }}>
              <AutoSizer>
                {({ height, width }) => (
                  <FixedSizeGrid
                    height={height}
                    width={width}
                    columnCount={calenderDates.length}
                    columnWidth={74}
                    rowCount={1}
                    rowHeight={37}
                    ref={calenderDatesRef}
                    outerRef={mainGridContainerRef}
                    onScroll={handleScroll}>
                    {DateRow}
                  </FixedSizeGrid>
                )}
              </AutoSizer>
            </Grid>
          </Grid>

          {data?.pages.map((page, pageIndex) => (
            <PageRoomList
              key={pageIndex}
              rooms={page.room_categories}
              InventoryRefs={InventoryRefs}
              handleCalenderScroll={handleScroll}
            />
          ))}

          <div
            ref={loadMoreRef}
            style={{ height: "20px", marginTop: "10px" }}
          />

          {!hasNextPage && data && (
            <Box sx={{ textAlign: "center", p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                All rooms loaded
              </Typography>
            </Box>
          )}

          {(isLoading || isFetchingNextPage) && (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {isError && (
            <Box sx={{ textAlign: "center", p: 4 }}>
              <Typography color="error">
                Error loading data. Please try again.
              </Typography>
            </Box>
          )}
        </Card>
      </Box>
    </Container>
  );
}
