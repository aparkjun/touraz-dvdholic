-- Apple 등 OAuth 재로그인 시 id_token에 이메일이 없어도 동일 일반(users) 계정으로 이어지도록
-- (provider, provider_id) → users.USER_ID 매핑을 저장한다.

CREATE TABLE IF NOT EXISTS `oauth_account_links`
(
    LINK_ID     VARCHAR(255) NOT NULL COMMENT '링크 PK',
    USER_ID     VARCHAR(255) NOT NULL COMMENT 'users.USER_ID',
    PROVIDER    VARCHAR(64)  NOT NULL COMMENT 'oauth2 client id (kakao, apple 등)',
    PROVIDER_ID VARCHAR(255) NOT NULL COMMENT '제공사 고유 id (카카오 회원번호, Apple sub)',

    CREATED_AT  DATETIME     NOT NULL COMMENT '생성일자',
    CREATED_BY  VARCHAR(50)  NOT NULL COMMENT '생성자',
    MODIFIED_AT DATETIME     NOT NULL COMMENT '수정일자',
    MODIFIED_BY VARCHAR(50)  NOT NULL COMMENT '수정자',

    PRIMARY KEY (`LINK_ID`),
    UNIQUE KEY `UK_OAUTH_PROVIDER` (`PROVIDER`, `PROVIDER_ID`)
);
