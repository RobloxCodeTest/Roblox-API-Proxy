export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }

    try {
      const targetEndpoint = request.headers.get("x-api-endpoint"); // e.g. "/v2/places/123456"
      const targetDomain = request.headers.get("x-api-domain") || "apis.roblox.com"; // Default domain
      const targetMethod = (request.headers.get("x-api-method") || request.method).toUpperCase(); // ANY method
      const apiKey = request.headers.get("x-api-key");

      if (!targetEndpoint) {
        return new Response(JSON.stringify({ error: "Missing x-api-endpoint header" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const targetUrl = `https://${targetDomain}${targetEndpoint}`;

      const forwardHeaders = new Headers();
      
      const contentType = request.headers.get("content-type") || "application/json";
      forwardHeaders.set("Content-Type", contentType);

      if (apiKey) {
        forwardHeaders.set("x-api-key", apiKey);
      } else if (env.ROBLOSECURITY) {
        forwardHeaders.set("Cookie", `.ROBLOSECURITY=${env.ROBLOSECURITY}`);
        
        const csrfToken = request.headers.get("x-csrf-token");
        if (csrfToken) {
          forwardHeaders.set("X-CSRF-Token", csrfToken);
        }
      }

      request.headers.forEach((value, key) => {
        if (key.startsWith("x-roblox-")) {
          const headerName = key.replace("x-roblox-", "");
          forwardHeaders.set(headerName, value);
        }
      });

      let bodyData = undefined;
      if (["POST", "PUT", "PATCH", "DELETE"].includes(targetMethod)) {
        const text = await request.text();
        if (text && text.length > 0) {
          bodyData = text;
        }
      }

      const robloxResponse = await fetch(targetUrl, {
        method: targetMethod,
        headers: forwardHeaders,
        body: bodyData
      });

      const responseData = await robloxResponse.text();

      const responseHeaders = new Headers({
        "Content-Type": robloxResponse.headers.get("content-type") || "application/json"
      });

      if (robloxResponse.headers.has("x-csrf-token")) {
        responseHeaders.set("x-csrf-token", robloxResponse.headers.get("x-csrf-token"));
      }

      return new Response(responseData, {
        status: robloxResponse.status,
        headers: responseHeaders
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
