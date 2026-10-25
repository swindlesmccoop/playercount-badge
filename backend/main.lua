local http = require("http")
local json = require("json")
local logger = require("logger")
local millennium = require("millennium")

function FetchPlayerCount(appId)
    if type(appId) ~= "number" then
        return json.encode({ error = "invalid appId type" })
    end

    if appId < 1 or appId ~= math.floor(appId) then
        return json.encode({ error = "invalid appId value" })
    end

    local url = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid="
        .. tostring(appId)

    -- Bound the request: the frontend refreshes every 30s, so a hung request
    -- must fail fast instead of wedging the badge update loop.
    local res, err = http.get(url, { timeout = 10 })
    if not res then
        logger:error("FetchPlayerCount request failed: " .. tostring(err))
        return json.encode({ error = tostring(err) })
    end

    if res.status < 200 or res.status >= 300 then
        return json.encode({ error = "status " .. tostring(res.status) })
    end

    return res.body
end

local function on_load()
    millennium.ready()
    logger:info("Player Count backend loaded")
end

local function on_unload()
    logger:info("Player Count backend unloaded")
end

local function on_frontend_loaded()
end

return {
    on_frontend_loaded = on_frontend_loaded,
    on_load = on_load,
    on_unload = on_unload
}
