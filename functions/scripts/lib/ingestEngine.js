async function runChunkedBackfill({
    symbol,
    barSize,
    whatToShow,
    useRTH,
    start,
    end,
    initialChunkDays,
    minChunkDays,
    maxChunkDays,
    untilEmpty,
    maxEmpty,
    maxTimeouts,
    sleepMs,
    dryRun,
    fetchBars,
    mapBars,
    insertRows,
    formatYmd,
    toEndDateTime,
    logger,
    formatDuration,
    growthStepDays
}) {
    const formatDurationLabel = formatDuration || ((days) => `${days} D`);
    const stepDays = Number.isFinite(growthStepDays) && growthStepDays > 0 ? growthStepDays : 1;
    let cursor = new Date(end);
    let currentChunkDays = initialChunkDays;
    let emptyStreak = 0;
    let successStreak = 0;
    let timeoutStreak = 0;

    while (cursor >= start) {
        const chunkEnd = new Date(cursor);
        const chunkStart = new Date(chunkEnd.getTime() - (currentChunkDays - 1) * 24 * 60 * 60 * 1000);
        if (chunkStart < start) chunkStart.setTime(start.getTime());

        const durationDays = Math.max(1, Math.ceil((chunkEnd.getTime() - chunkStart.getTime()) / (24 * 60 * 60 * 1000)));
        const duration = formatDurationLabel(durationDays);
        logger.info(`Fetching ${symbol} ${duration} ending ${formatYmd(chunkEnd)}...`);

        let bars;
        try {
            bars = await fetchBars({
                symbol,
                duration,
                barSize,
                endDateTime: toEndDateTime(chunkEnd),
                whatToShow,
                useRTH
            });
        } catch (error) {
            const message = error?.message || String(error);
            logger.warn(`Chunk failed (${duration}): ${message}`);
            if (message.includes('timeout') && currentChunkDays > minChunkDays) {
                currentChunkDays = Math.max(minChunkDays, Math.ceil(currentChunkDays / 2));
                logger.info(`Reducing chunk size to ${currentChunkDays}d and retrying.`);
                await new Promise((resolve) => setTimeout(resolve, sleepMs));
                continue;
            }
            if (message.includes('timeout')) {
                timeoutStreak += 1;
                if (timeoutStreak >= maxTimeouts) {
                    logger.warn(`Stopping after ${timeoutStreak} timeouts at min chunk size.`);
                    break;
                }
            }
            cursor = new Date(chunkStart.getTime() - 24 * 60 * 60 * 1000);
            await new Promise((resolve) => setTimeout(resolve, sleepMs));
            continue;
        }

        const rows = mapBars(bars);
        if (!rows.length) {
            logger.info('No bars returned.');
            emptyStreak += 1;
            successStreak = 0;
            timeoutStreak = 0;
            if (untilEmpty && emptyStreak >= maxEmpty) {
                logger.info(`Stopping after ${emptyStreak} empty chunks.`);
                break;
            }
        } else if (dryRun) {
            logger.info(`Dry run: ${rows.length} bars.`);
            emptyStreak = 0;
            successStreak += 1;
            timeoutStreak = 0;
        } else {
            await insertRows(rows);
            logger.info(`Inserted ${rows.length} bars.`);
            emptyStreak = 0;
            successStreak += 1;
            timeoutStreak = 0;
        }

        cursor = new Date(chunkStart.getTime() - 24 * 60 * 60 * 1000);
        if (successStreak >= 3 && currentChunkDays < maxChunkDays) {
            currentChunkDays = Math.min(maxChunkDays, currentChunkDays + stepDays);
            successStreak = 0;
        }
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
}

async function runDateListIngest({
    symbol,
    barSize,
    whatToShow,
    useRTH,
    dates,
    sleepMs,
    dryRun,
    fetchBars,
    mapBars,
    insertRows,
    toEndDateTime,
    logger
}) {
    for (const date of dates) {
        logger.info(`Fetching ${symbol} ${barSize} for ${date}...`);
        let bars;
        try {
            bars = await fetchBars({
                symbol,
                duration: '1 D',
                barSize,
                endDateTime: toEndDateTime(new Date(`${date}T23:59:59Z`)),
                whatToShow,
                useRTH
            });
        } catch (error) {
            logger.warn(`Failed ${date}: ${error?.message || error}`);
            await new Promise((resolve) => setTimeout(resolve, sleepMs));
            continue;
        }

        const rows = mapBars(bars);
        if (!rows.length) {
            logger.info(`No bars returned for ${date}.`);
        } else if (dryRun) {
            logger.info(`Dry run: ${rows.length} bars for ${date}.`);
        } else {
            await insertRows(rows);
            logger.info(`Inserted ${rows.length} bars for ${date}.`);
        }

        await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
}

module.exports = {
    runChunkedBackfill,
    runDateListIngest
};
