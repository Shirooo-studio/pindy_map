require "test_helper"

class UsersControllerTest < ActionDispatch::IntegrationTest
  test "should get show" do
    get users_show_url
    assert_response :success
  end

  test "should get pins" do
    get users_pins_url
    assert_response :success
  end

  test "should get posts" do
    get users_posts_url
    assert_response :success
  end
end
