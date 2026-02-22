-- Fix broken cron schedule (was pointing to placeholder URL)
select cron.unschedule('process-monitoring-queue');

select cron.schedule(
    'process-monitoring-queue',
    '*/10 * * * *',
    $$
    select net.http_post(
        url:='https://pkiqnjhuutcnzauhyyqs.supabase.co/functions/v1/send-scheduled-sms',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_sPEsS8NAWyR3-8GSo7Smvw_q7WEqz9B"}'
    ) as request_id;
    $$
);
