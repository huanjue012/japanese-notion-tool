import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            headless=True
        )
        page = await browser.new_page()
        
        # Navigate to notes page
        await page.goto("http://localhost:8000/notes", wait_until="networkidle", timeout=15000)
        await page.wait_for_timeout(2000)
        
        # Screenshot initial state
        await page.screenshot(path=r"C:\Users\Kee\AppData\Local\Temp\verify_1_initial.png")
        
        # Check for ○ button on cards
        studied_buttons = await page.query_selector_all('button[title="标为已学"]')
        print(f"Found {len(studied_buttons)} unstudied (○) buttons")
        
        # Check filter buttons exist
        unstudied_filter = await page.query_selector('button:has-text("○ 未学")')
        studied_filter = await page.query_selector('button:has-text("✓ 已学")')
        print(f"未学 filter button exists: {unstudied_filter is not None}")
        print(f"已学 filter button exists: {studied_filter is not None}")
        
        # Check progress counter
        progress = await page.query_selector('span:has-text("已学")')
        if progress:
            text = await progress.inner_text()
            print(f"Progress counter: {text}")
        else:
            print("Progress counter: not found")
        
        # Click ○ on first note card to mark as studied
        if studied_buttons:
            await studied_buttons[0].click()
            await page.wait_for_timeout(500)
            await page.screenshot(path=r"C:\Users\Kee\AppData\Local\Temp\verify_2_after_click.png")
            
            # Check button changed to ✓
            now_studied = await page.query_selector('button[title="标为未学"]')
            print(f"After click - ✓ button exists: {now_studied is not None}")
            
            # Check progress updated
            progress2 = await page.query_selector('span:has-text("已学")')
            if progress2:
                text2 = await progress2.inner_text()
                print(f"Progress after marking: {text2}")
        
        # Test 未学 filter
        if unstudied_filter:
            await unstudied_filter.click()
            await page.wait_for_timeout(500)
            await page.screenshot(path=r"C:\Users\Kee\AppData\Local\Temp\verify_3_unstudied_filter.png")
            remaining = await page.query_selector_all('button[title="标为已学"]')
            print(f"After 未学 filter: {len(remaining)} unstudied cards showing")
        
        # Test 已学 filter
        if studied_filter:
            # Click again to reset first
            if unstudied_filter:
                await unstudied_filter.click()
                await page.wait_for_timeout(300)
            await studied_filter.click()
            await page.wait_for_timeout(500)
            await page.screenshot(path=r"C:\Users\Kee\AppData\Local\Temp\verify_4_studied_filter.png")
            remaining_studied = await page.query_selector_all('button[title="标为未学"]')
            print(f"After 已学 filter: {len(remaining_studied)} studied cards showing")
        
        # Toggle back: click ✓ to un-study
        already_studied = await page.query_selector_all('button[title="标为未学"]')
        if already_studied:
            await already_studied[0].click()
            await page.wait_for_timeout(500)
            back_to_circle = await page.query_selector('button[title="标为已学"]')
            print(f"After un-study click - ○ back: {back_to_circle is not None}")
        
        await browser.close()

asyncio.run(main())
