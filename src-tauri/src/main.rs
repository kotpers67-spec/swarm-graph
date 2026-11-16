#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    swarm_graph_lib::run()
}

#[cfg(test)]
mod tests {
    use std::fs::{self, File};
    use std::io::Write;
    use swarm_graph_lib::scanner::{
        extract_mentions, extract_seq_refs, load_session_detail, scan_sessions,
    };
    use swarm_graph_lib::translator::{
        mask_technical_tokens, needs_translation_to_ru, parse_clients5_response,
        parse_gtx_response, unmask_technical_tokens,
    };

    #[test]
    fn extracts_mentions_and_seq_refs() {
        let text = "@verifier check #4 and #12 from @bexum-audit; ignore email test@example.com";
        let mentions = extract_mentions(text);
        assert!(mentions.contains(&"verifier".to_string()));
        assert!(mentions.contains(&"bexum-audit".to_string()));
        assert_eq!(extract_seq_refs(text), vec![4, 12]);
    }

    #[test]
    fn parses_synthetic_swarm_session() {
        let tmp = std::env::temp_dir().join("swarm_graph_bin_unit_test");
        let _ = fs::remove_dir_all(&tmp);
        let conv = tmp.join("conv-1");
        let swarm_dir = conv.join(".system_generated").join("swarm");
        let sub_dir = conv.join(".system_generated").join("subagents");
        fs::create_dir_all(&swarm_dir).unwrap();
        fs::create_dir_all(&sub_dir).unwrap();

        fs::write(
            swarm_dir.join("swarm.json"),
            r#"{"version":1,"backend":"local","swarm_id":"conv-1","created_at":"2026-11-11T10:00:00Z"}"#,
        )
        .unwrap();

        fs::write(
            swarm_dir.join("members.json"),
            r#"{"title":"Test Swarm","members":{"coordinator":{"conversation_id":"conv-1","role":"coordinator","phase":"RUNNING","model":"gemini-3.8-flash","wake_mode":"mentions","killed":false},"worker-a":{"conversation_id":"conv-2","role":"worker","phase":"RUNNING","model":"gemini-3.8-flash","wake_mode":"working","killed":false}}}"#,
        )
        .unwrap();

        let mut board_file = File::create(swarm_dir.join("board.jsonl")).unwrap();
        writeln!(
            board_file,
            r#"{{"seq":1,"agent":"coordinator","text":"@worker-a start task","time":"2026-11-11 10:00:01","kind":"brief","request_id":"r1"}}"#
        )
        .unwrap();
        writeln!(
            board_file,
            r#"{{"seq":2,"agent":"worker-a","text":"@coordinator done #1","time":"2026-11-11 10:00:05","kind":"post","request_id":"r2"}}"#
        )
        .unwrap();

        fs::write(
            sub_dir.join("sub-1.json"),
            r#"{"conversationId":"sub-1","subagentDescriptor":{"typeName":"research","role":"Code Searcher"},"state":"SUBAGENT_STATE_ALIVE","spawnStepIndex":3}"#,
        )
        .unwrap();

        let summaries = scan_sessions(&tmp);
        let swarm_summaries: Vec<_> = summaries.into_iter().filter(|s| s.id == "conv-1").collect();
        assert_eq!(swarm_summaries.len(), 1);
        assert_eq!(swarm_summaries[0].title, "Test Swarm");
        assert_eq!(swarm_summaries[0].member_count, 2);
        assert_eq!(swarm_summaries[0].subagent_count, 1);
        assert_eq!(swarm_summaries[0].board_count, 2);

        let detail = load_session_detail(&tmp, "conv-1").unwrap();
        assert_eq!(detail.board[1].mentions, vec!["coordinator".to_string()]);
        assert_eq!(detail.board[1].seq_refs, vec![1]);
        assert_eq!(detail.subagents[0].role, "Code Searcher");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn detects_english_and_preserves_tokens() {
        assert!(needs_translation_to_ru(
            "You own src/parser.rs. Make the three failing cases pass."
        ));
        assert!(needs_translation_to_ru("Done"));
        assert!(needs_translation_to_ru("Fatal error"));
        assert!(needs_translation_to_ru("Задача: Run tests now"));
        assert!(!needs_translation_to_ru(
            "Проверь конфиг Bexum Connect и отправь отчёт @verifier"
        ));
        let src = "@verifier check #4 in `src/lib.rs` and C:\\Users\\kotpe\\test.json";
        let (masked, tokens) = mask_technical_tokens(src);
        assert_eq!(unmask_technical_tokens(&masked, &tokens), src);
    }

    #[test]
    fn unmasks_tokens_with_case_and_spacing_variations() {
        let tokens = vec!["`test_file.rs`".to_string(), "@verifier".to_string()];
        // Google Translate might return lowercase or spaced placeholder tags
        let translated = "Проверьте [[m0]] и обратитесь к [ [ M1 ] ] для отчета";
        let unmasked = unmask_technical_tokens(translated, &tokens);
        assert_eq!(unmasked, "Проверьте `test_file.rs` и обратитесь к @verifier для отчета");
    }

    #[test]
    fn parses_gtx_and_clients5_responses() {
        // GTX format: [[["Привет, мир", "Hello, world", null, null, 1]]]
        let gtx_val: serde_json::Value = serde_json::json!([
            [["Привет, ", "Hello, ", null, null, 1], ["мир", "world", null, null, 1]]
        ]);
        assert_eq!(parse_gtx_response(&gtx_val), Some("Привет, мир".to_string()));

        // Clients5 array-of-arrays format: [["Привет, мир\nВторая строка", "en"]]
        let clients5_nested: serde_json::Value = serde_json::json!([
            ["Привет, мир\nВторая строка", "en"]
        ]);
        assert_eq!(
            parse_clients5_response(&clients5_nested),
            Some("Привет, мир\nВторая строка".to_string())
        );

        // Clients5 simple array format: ["Привет"]
        let clients5_simple: serde_json::Value = serde_json::json!(["Привет"]);
        assert_eq!(parse_clients5_response(&clients5_simple), Some("Привет".to_string()));
    }

    #[test]
    fn masks_tags_windows_paths_and_code() {
        let text = "<SYSTEM_MESSAGE> Check ```bash\ncargo test\n``` at F:/Projects/test and C:\\data\\file.txt";
        let (masked, tokens) = mask_technical_tokens(text);
        assert_eq!(tokens.len(), 4);
        assert_eq!(tokens[0], "<SYSTEM_MESSAGE>");
        assert_eq!(tokens[1], "```bash\ncargo test\n```");
        assert_eq!(tokens[2], "F:/Projects/test");
        assert_eq!(tokens[3], "C:\\data\\file.txt");
        assert_eq!(unmask_technical_tokens(&masked, &tokens), text);
    }
}
