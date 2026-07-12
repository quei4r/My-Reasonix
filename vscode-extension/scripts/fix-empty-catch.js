// Fix empty/comment-only catch {} blocks in try-catch statements.
// Replaces: } catch { }
// With:     } catch (err) { console.error("[catch] file:context", err); }
// Also fixes already-broken replacements from a previous run.
const fs = require("fs");
const path = require("path");

const SRC = "/home/quei/code/tools/My-Reasonix/vscode-extension/frontend/src";

// Fix already-broken lines first: catch (err) { console.error("[catch] broken...
// These have string content with unterminated quotes.
function fixBroken(content, file) {
  return content.replace(
    /\}\s*catch\s*\(err\)\s*\{\s*console\.error\(\s*"\[catch\][^"]*"(?:\s*:\s*)?[^}]*\}\s*$/gm,
    (match) => {
      const fname = path.basename(file);
      return `} catch (err) { console.error("[catch] ${fname}:catch", err); }`;
    }
  );
}

// Fix truly empty catch {} (with optional comment)
function fixEmpty(content, file) {
  const fname = path.basename(file);
  // Match: } catch { }
  // Match: } catch { /* comment */ }
  // But NOT: } catch { return ... } (has actual code)
  return content.replace(
    /\}\s*catch\s*\{\s*(\/\*[\s\S]*?\*\/)?\s*\}\s*$/gm,
    (match, comment) => {
      // Only match if inside braces is just whitespace and/or a comment
      if (comment) {
        return `} catch (err) { console.error("[catch] ${fname}:${comment.replace(/\/\*|\*\//g,'').trim()}", err); }`;
      }
      return `} catch (err) { console.error("[catch] ${fname}:catch", err); }`;
    }
  );
}

let fixed = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== "__tests__" && e.name !== "__mocks__") walk(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      let content = fs.readFileSync(p, "utf8");
      const orig = content;
      content = fixBroken(content, p);
      content = fixEmpty(content, p);
      if (content !== orig) {
        fs.writeFileSync(p, content, "utf8");
        fixed++;
        console.log("Fixed:", path.relative(SRC, p));
      }
    }
  }
}
walk(SRC);
console.log("Done. Fixed", fixed, "files.");
